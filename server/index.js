import fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import archiver from 'archiver';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { config } from './config.js';
import { parseSettings } from './settings.js';
import { saveUploadToTemp, readSourceProjects } from './zip.js';
import { baseNameWithoutExtension, sanitizeFilename, UserError } from './utils.js';
import { applyFilters, applyFiltersWithLineNumbers } from '../shared/filters.js';
import {
  buildFileHtml,
  buildFooterTemplate,
  buildHeaderTemplate,
  buildPdfOptions,
  closeSharedBrowser,
  createPdfRenderer,
  createRenderContext,
} from './render.js';

const app = fastify({ logger: false });
const RENDER_CONCURRENCY = Math.max(1, config.renderConcurrency);
const MAX_ACTIVE_JOBS = Math.max(1, config.maxActiveJobs);
const MAX_QUEUED_JOBS = Math.max(0, config.maxQueuedJobs);
const jobs = new Map();
const JOB_TTL_MS = 5 * 60 * 1000;
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serverDir, '..');
const distDir = path.join(projectRoot, 'dist');
let directRendersInFlight = 0;

if (process.env.NODE_ENV !== 'production') {
  app.register(cors, { origin: true });
}

app.register(multipart, {
  limits: {
    fileSize: config.maxZipBytes,
    files: 1,
  },
});

app.get('/api/health', async () => ({ status: 'ok' }));

function isApiPath(url) {
  const pathName = String(url || '').split('?')[0];
  return pathName === '/api' || pathName.startsWith('/api/');
}

async function registerProductionFrontend() {
  await app.register(staticFiles, {
    root: distDir,
    prefix: '/',
  });

  app.setNotFoundHandler((request, reply) => {
    if (isApiPath(request.url)) {
      reply.code(404).send({ error: 'Not found.' });
      return;
    }

    reply.sendFile('index.html');
  });
}

async function renderFilePdf({ file, projectName, settings, renderer, theme, highlighter, fontCss }) {
  let content = file.content;
  let lineNumbers = null;
  let maxLineNumber = null;
  const fileSettings = { ...settings, language: file.language };

  if (settings.showLineNumbers) {
    const result = applyFiltersWithLineNumbers(file.content, fileSettings);
    content = result.lines.map((line) => line.text).join('\n');
    lineNumbers = result.lines.map((line) => line.number);
    maxLineNumber = result.maxLineNumber;
  } else {
    content = applyFilters(file.content, fileSettings);
  }

  const html = buildFileHtml({
    content,
    lineNumbers,
    maxLineNumber,
    showLineNumbers: settings.showLineNumbers,
    theme,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    highlighter,
    fontFamily: settings.fontFamily,
    fontCss,
    language: file.language,
  });
  const headerTemplate = buildHeaderTemplate({
    settings,
    projectName,
    fileName: file.name,
    filePath: file.path,
    fontCss,
  });
  const footerTemplate = buildFooterTemplate({ settings, fontCss });
  const pdfOptions = buildPdfOptions({ headerTemplate, footerTemplate });
  return renderer.render(html, pdfOptions);
}

async function mapWithConcurrency(items, limit, mapper, onItemDone) {
  if (items.length === 0) return [];
  const results = new Array(items.length);
  let nextIndex = 0;
  let active = 0;

  return new Promise((resolve, reject) => {
    const launch = () => {
      while (active < limit && nextIndex < items.length) {
        const currentIndex = nextIndex++;
        active += 1;
        Promise.resolve(mapper(items[currentIndex], currentIndex))
          .then((result) => {
            results[currentIndex] = result;
            if (onItemDone) {
              try {
                onItemDone(result, currentIndex);
              } catch (error) {
                reject(error);
                return;
              }
            }
            active -= 1;
            if (nextIndex >= items.length && active === 0) {
              resolve(results);
              return;
            }
            launch();
          })
          .catch(reject);
      }
    };

    launch();
  });
}

async function appendPdfPages(targetDoc, pdfBuffer) {
  const sourceDoc = await PDFDocument.load(pdfBuffer);
  const pageIndices = sourceDoc.getPageIndices();
  const pages = await targetDoc.copyPages(sourceDoc, pageIndices);
  pages.forEach((page) => targetDoc.addPage(page));
  const pageCount = pageIndices.length;
  const pageSize = pageCount > 0 ? sourceDoc.getPage(0).getSize() : null;
  return { pageCount, pageSize };
}

function insertPaddingPages(targetDoc, pageCount, pageSize, multiple) {
  if (multiple <= 1 || pageCount === 0) return;
  const remainder = pageCount % multiple;
  if (remainder === 0) return;
  const padding = multiple - remainder;
  const fallbackSize = { width: 595.28, height: 841.89 };
  const size = pageSize || fallbackSize;
  for (let i = 0; i < padding; i += 1) {
    targetDoc.addPage([size.width, size.height]);
  }
}

function filterProjectsByIncluded(projects, includedFiles) {
  if (!Array.isArray(includedFiles)) return projects;
  const allowed = new Set(includedFiles);
  return projects
    .map((project) => ({
      ...project,
      files: project.files.filter((file) => allowed.has(file.path)),
    }))
    .filter((project) => project.files.length > 0);
}

function countProjectFiles(projects) {
  return projects.reduce((sum, project) => sum + project.files.length, 0);
}

function createJob(uploadInfo, settings) {
  const job = {
    id: randomUUID(),
    status: 'pending',
    totalFiles: 0,
    completedFiles: 0,
    output: null,
    error: null,
    clients: new Set(),
    cleanupTimer: null,
    uploadInfo,
    settings,
  };
  jobs.set(job.id, job);
  return job;
}

function getProgressPayload(job) {
  const total = job.totalFiles;
  const completed = job.completedFiles;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
}

function sendJobEvent(job, event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of job.clients) {
    client.write(message);
  }
}

function closeJobClients(job) {
  for (const client of job.clients) {
    client.end();
  }
  job.clients.clear();
}

function scheduleJobCleanup(job, delay = JOB_TTL_MS) {
  if (job.cleanupTimer) {
    clearTimeout(job.cleanupTimer);
  }
  job.cleanupTimer = setTimeout(() => {
    jobs.delete(job.id);
  }, delay);
}

function countRunningJobs() {
  let count = 0;
  for (const job of jobs.values()) {
    if (job.status === 'running') count += 1;
  }
  return count;
}

function countPendingJobs() {
  let count = 0;
  for (const job of jobs.values()) {
    if (job.status === 'pending') count += 1;
  }
  return count;
}

function countActiveSlotsInUse() {
  return countRunningJobs() + directRendersInFlight;
}

function canAcceptQueuedRender() {
  if (countActiveSlotsInUse() < MAX_ACTIVE_JOBS) return true;
  return countPendingJobs() < MAX_QUEUED_JOBS;
}

function startQueuedJobs() {
  while (countActiveSlotsInUse() < MAX_ACTIVE_JOBS) {
    const nextJob = Array.from(jobs.values()).find((job) => job.status === 'pending');
    if (!nextJob) break;
    void runRenderJob(nextJob);
  }
}

async function buildZipBuffer(entries) {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = new PassThrough();
  const chunks = [];

  return new Promise((resolve, reject) => {
    archive.on('error', reject);
    stream.on('error', reject);
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));

    archive.pipe(stream);
    entries.forEach((entry) => {
      archive.append(entry.buffer, { name: entry.name });
    });
    archive.finalize();
  });
}

async function renderMergedPdf({ fileQueue, settings, renderer, theme, highlighter, fontCss, onFileDone }) {
  const merged = await PDFDocument.create();
  const pdfBuffers = await mapWithConcurrency(
    fileQueue,
    RENDER_CONCURRENCY,
    (item) =>
      renderFilePdf({
        file: item.file,
        projectName: item.projectName,
        settings,
        renderer,
        theme,
        highlighter,
        fontCss,
      }),
    () => {
      if (onFileDone) onFileDone();
    },
  );

  let currentProject = null;
  let projectPages = 0;
  let lastPageSize = null;

  for (let index = 0; index < pdfBuffers.length; index += 1) {
    const { projectName } = fileQueue[index];
    if (currentProject === null) {
      currentProject = projectName;
    }

    if (projectName !== currentProject) {
      insertPaddingPages(merged, projectPages, lastPageSize, settings.pageBreakMultiple);
      currentProject = projectName;
      projectPages = 0;
      lastPageSize = null;
    }

    const pdf = pdfBuffers[index];
    const { pageCount, pageSize } = await appendPdfPages(merged, pdf);
    projectPages += pageCount;
    if (pageSize) {
      lastPageSize = pageSize;
    }
  }

  return Buffer.from(await merged.save());
}

async function runRenderJob(job) {
  if (job.status !== 'pending') return;

  const { tempDir, zipPath, originalName } = job.uploadInfo;
  const settings = job.settings;
  job.status = 'running';

  try {
    let projects = await readSourceProjects(zipPath, config, settings.projectLevel);
    projects = filterProjectsByIncluded(projects, settings.includedFiles);
    const totalFiles = countProjectFiles(projects);
    if (Array.isArray(settings.includedFiles) && totalFiles === 0) {
      throw new UserError('No files selected.', 422);
    }
    job.totalFiles = totalFiles;
    job.completedFiles = 0;
    sendJobEvent(job, 'progress', getProgressPayload(job));

    const renderer = await createPdfRenderer();
    try {
      const { theme, highlighter, fontCss } = await createRenderContext(settings);
      const onFileDone = () => {
        job.completedFiles += 1;
        sendJobEvent(job, 'progress', getProgressPayload(job));
      };

      if (settings.outputMode === 'single') {
        const fileQueue = projects.flatMap((project) =>
          project.files.map((file) => ({
            projectName: project.name,
            file,
          })),
        );
        const pdfBuffer = await renderMergedPdf({
          fileQueue,
          settings,
          renderer,
          theme,
          highlighter,
          fontCss,
          onFileDone,
        });
        job.output = {
          buffer: pdfBuffer,
          filename: `${baseNameWithoutExtension(originalName)}.pdf`,
          contentType: 'application/pdf',
        };
      } else {
        const entries = [];
        for (const project of projects) {
          const fileQueue = project.files.map((file) => ({
            projectName: project.name,
            file,
          }));
          const pdfBuffer = await renderMergedPdf({
            fileQueue,
            settings,
            renderer,
            theme,
            highlighter,
            fontCss,
            onFileDone,
          });
          entries.push({
            name: `${sanitizeFilename(project.name, 'project')}.pdf`,
            buffer: pdfBuffer,
          });
        }
        const zipBuffer = await buildZipBuffer(entries);
        job.output = {
          buffer: zipBuffer,
          filename: `${baseNameWithoutExtension(originalName)}.zip`,
          contentType: 'application/zip',
        };
      }

      job.status = 'done';
      sendJobEvent(job, 'progress', getProgressPayload(job));
      sendJobEvent(job, 'done', {
        filename: job.output.filename,
        contentType: job.output.contentType,
      });
      closeJobClients(job);
      scheduleJobCleanup(job);
    } finally {
      await renderer.close();
    }
  } catch (error) {
    const message = error instanceof UserError ? error.message : 'Failed to generate PDF.';
    job.status = 'error';
    job.error = message;
    sendJobEvent(job, 'failed', { error: message });
    closeJobClients(job);
    scheduleJobCleanup(job);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
    startQueuedJobs();
  }
}

app.post('/api/render', async (request, reply) => {
  if (countActiveSlotsInUse() >= MAX_ACTIVE_JOBS) {
    throw new UserError('Server is busy. Try again in a moment.', 429);
  }

  directRendersInFlight += 1;
  try {
    const parts = request.parts();
    let uploadInfo = null;
    let settingsPayload = null;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'zip') {
        if (uploadInfo) {
          throw new UserError('Only one zip file is allowed.', 400);
        }
        uploadInfo = await saveUploadToTemp(part, config);
      }
      if (part.type === 'field' && part.fieldname === 'settings') {
        settingsPayload = part.value;
      }
    }

    if (!uploadInfo) {
      throw new UserError('Zip file is required.', 400);
    }

    const settings = parseSettings(settingsPayload);
    const { tempDir, zipPath, originalName } = uploadInfo;

    try {
      let projects = await readSourceProjects(zipPath, config, settings.projectLevel);
      projects = filterProjectsByIncluded(projects, settings.includedFiles);
      if (Array.isArray(settings.includedFiles) && countProjectFiles(projects) === 0) {
        throw new UserError('No files selected.', 422);
      }
      const renderer = await createPdfRenderer();

      try {
        const { theme, highlighter, fontCss } = await createRenderContext(settings);

        if (settings.outputMode === 'single') {
          const fileQueue = projects.flatMap((project) =>
            project.files.map((file) => ({
              projectName: project.name,
              file,
            })),
          );
          const pdf = await renderMergedPdf({
            fileQueue,
            settings,
            renderer,
            theme,
            highlighter,
            fontCss,
          });
          const fileName = `${baseNameWithoutExtension(originalName)}.pdf`;

          reply
            .type('application/pdf')
            .header('Content-Disposition', `attachment; filename="${fileName}"`);
          return reply.send(pdf);
        }

        const zipName = `${baseNameWithoutExtension(originalName)}.zip`;
        reply.type('application/zip').header('Content-Disposition', `attachment; filename="${zipName}"`);

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (error) => reply.raw.destroy(error));
        reply.send(archive);

        for (const project of projects) {
          const fileQueue = project.files.map((file) => ({
            projectName: project.name,
            file,
          }));
          const pdf = await renderMergedPdf({
            fileQueue,
            settings,
            renderer,
            theme,
            highlighter,
            fontCss,
          });
          const pdfName = `${sanitizeFilename(project.name, 'project')}.pdf`;
          archive.append(pdf, { name: pdfName });
        }

        await archive.finalize();
        return reply;
      } finally {
        await renderer.close();
      }
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  } finally {
    directRendersInFlight = Math.max(0, directRendersInFlight - 1);
    startQueuedJobs();
  }
});

app.post('/api/render/start', async (request, reply) => {
  startQueuedJobs();
  if (!canAcceptQueuedRender()) {
    throw new UserError('Server is busy. Try again in a moment.', 429);
  }

  const parts = request.parts();
  let uploadInfo = null;
  let settingsPayload = null;

  for await (const part of parts) {
    if (part.type === 'file' && part.fieldname === 'zip') {
      if (uploadInfo) {
        throw new UserError('Only one zip file is allowed.', 400);
      }
      uploadInfo = await saveUploadToTemp(part, config);
    }
    if (part.type === 'field' && part.fieldname === 'settings') {
      settingsPayload = part.value;
    }
  }

  if (!uploadInfo) {
    throw new UserError('Zip file is required.', 400);
  }

  const settings = parseSettings(settingsPayload);
  if (!canAcceptQueuedRender()) {
    await fs.rm(uploadInfo.tempDir, { recursive: true, force: true });
    throw new UserError('Server is busy. Try again in a moment.', 429);
  }

  const job = createJob(uploadInfo, settings);

  reply.code(202).send({ jobId: job.id });
  startQueuedJobs();
});

app.get('/api/render/progress/:jobId', async (request, reply) => {
  const job = jobs.get(request.params.jobId);
  if (!job) {
    reply.code(404).send({ error: 'Render job not found.' });
    return;
  }

  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  reply.raw.write('\n');
  reply.hijack();

  job.clients.add(reply.raw);
  sendJobEvent(job, 'progress', getProgressPayload(job));

  if (job.status === 'done') {
    sendJobEvent(job, 'done', {
      filename: job.output.filename,
      contentType: job.output.contentType,
    });
    reply.raw.end();
    job.clients.delete(reply.raw);
    return;
  }

  if (job.status === 'error') {
    sendJobEvent(job, 'failed', { error: job.error || 'Render failed.' });
    reply.raw.end();
    job.clients.delete(reply.raw);
    return;
  }

  request.raw.on('close', () => {
    job.clients.delete(reply.raw);
  });
});

app.get('/api/render/download/:jobId', async (request, reply) => {
  const job = jobs.get(request.params.jobId);
  if (!job) {
    reply.code(404).send({ error: 'Render job not found.' });
    return;
  }

  if (job.status !== 'done' || !job.output) {
    reply.code(409).send({ error: 'Render not complete.' });
    return;
  }

  reply
    .type(job.output.contentType)
    .header('Content-Disposition', `attachment; filename="${job.output.filename}"`);
  const buffer = job.output.buffer;
  jobs.delete(job.id);
  reply.send(buffer);
});

app.setErrorHandler((error, request, reply) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error.';
  reply.code(statusCode).send({ error: message });
});

async function shutdown() {
  try {
    await app.close();
  } catch (error) {
    console.error('Error closing server', error);
  }

  try {
    await closeSharedBrowser();
  } catch (error) {
    console.error('Error closing browser', error);
  }
}

process.once('SIGINT', () => {
  shutdown().finally(() => process.exit(0));
});

process.once('SIGTERM', () => {
  shutdown().finally(() => process.exit(0));
});

process.once('beforeExit', (code) => {
  shutdown().finally(() => process.exit(code));
});

async function start() {
  if (process.env.NODE_ENV === 'production') {
    await registerProductionFrontend();
  }

  await app.listen({ host: config.host, port: config.port });
}

start().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
