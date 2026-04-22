import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import unzipper from 'unzipper';
import { sanitizeFilename, UserError } from './utils.js';
import { getLanguageForExtension, isSourceFile } from '../shared/languages.js';

const SOURCE_FILE_TOO_LARGE_MESSAGE = 'A source file exceeds the allowed size.';
const UMZ_FILE_TOO_LARGE_MESSAGE = 'An embedded .umz file exceeds the allowed size.';

export async function saveUploadToTemp(filePart, config) {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), config.tempPrefix));
  const safeName = sanitizeFilename(filePart.filename || 'upload.zip', 'upload.zip');
  const zipPath = path.join(tempDir, safeName);

  await pipeline(filePart.file, fs.createWriteStream(zipPath));
  return { tempDir, zipPath, originalName: filePart.filename || 'upload.zip' };
}

export async function readSourceProjects(zipPath, config, projectLevel = 1) {
  const directory = await unzipper.Open.file(zipPath);
  const projectMap = new Map();
  let totalBytes = 0;
  let fileCount = 0;
  const level = Math.min(3, Math.max(1, Number.parseInt(projectLevel, 10) || 1));

  function shouldIgnorePath(normalizedPath) {
    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.length === 0) return true;
    if (segments.some((segment) => segment.toLowerCase() === '__macosx')) return true;
    const fileName = segments[segments.length - 1];
    return fileName.startsWith('.');
  }

  function addSourceFile(projectName, filePath, content) {
    fileCount += 1;
    if (fileCount > config.maxFileCount) {
      throw new UserError('Too many source files in the zip.', 413);
    }

    if (!projectMap.has(projectName)) {
      projectMap.set(projectName, []);
    }

    projectMap.get(projectName).push({
      name: path.basename(filePath),
      path: filePath,
      content,
      language: getLanguageForExtension(filePath) ?? 'plaintext',
    });
  }

  function addToTotalBytes(byteCount) {
    totalBytes += byteCount;
    if (totalBytes > config.maxTotalBytes) {
      throw new UserError('Total source size exceeds the allowed limit.', 413);
    }
  }

  async function processSourceEntry(entry, normalizedPath, projectName) {
    const entrySize = Number(entry.uncompressedSize);
    const hasEntrySize = Number.isFinite(entrySize) && entrySize >= 0;
    if (hasEntrySize && entrySize > config.maxFileBytes) {
      throw new UserError(SOURCE_FILE_TOO_LARGE_MESSAGE, 413);
    }

    const buffer = await readEntryBuffer(entry, {
      maxBytes: config.maxFileBytes,
      tooLargeMessage: SOURCE_FILE_TOO_LARGE_MESSAGE,
      onChunk: addToTotalBytes,
    });
    addSourceFile(projectName, normalizedPath, buffer.toString('utf8'));
  }

  async function processUmzEntry(entry, normalizedPath, projectName) {
    const entrySize = Number(entry.uncompressedSize);
    const hasEntrySize = Number.isFinite(entrySize) && entrySize >= 0;
    if (hasEntrySize && entrySize > config.maxUmzBytes) {
      throw new UserError(UMZ_FILE_TOO_LARGE_MESSAGE, 413);
    }

    const umzBuffer = await readEntryBuffer(entry, {
      maxBytes: config.maxUmzBytes,
      tooLargeMessage: UMZ_FILE_TOO_LARGE_MESSAGE,
    });
    let nestedDirectory;
    try {
      nestedDirectory = await unzipper.Open.buffer(umzBuffer);
    } catch (_error) {
      return;
    }

    for (const nestedEntry of nestedDirectory.files) {
      if (nestedEntry.type !== 'File') continue;
      const nestedPath = nestedEntry.path.replace(/\\/g, '/');
      if (!isSourceFile(nestedPath)) continue;
      if (nestedPath.startsWith('/') || nestedPath.includes('..')) continue;
      if (shouldIgnorePath(nestedPath)) continue;

      const combinedPath = `${normalizedPath}/${nestedPath}`;
      const entrySize = Number(nestedEntry.uncompressedSize);
      const hasEntrySize = Number.isFinite(entrySize) && entrySize >= 0;
      if (hasEntrySize && entrySize > config.maxFileBytes) {
        throw new UserError(SOURCE_FILE_TOO_LARGE_MESSAGE, 413);
      }

      const sourceBuffer = await readEntryBuffer(nestedEntry, {
        maxBytes: config.maxFileBytes,
        tooLargeMessage: SOURCE_FILE_TOO_LARGE_MESSAGE,
        onChunk: addToTotalBytes,
      });
      addSourceFile(projectName, combinedPath, sourceBuffer.toString('utf8'));
    }
  }

  for (const entry of directory.files) {
    if (entry.type !== 'File') continue;
    const normalizedPath = entry.path.replace(/\\/g, '/');
    if (normalizedPath.startsWith('/') || normalizedPath.includes('..')) continue;
    if (shouldIgnorePath(normalizedPath)) continue;

    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.length < level + 1) continue;
    const projectName = segments[level - 1];

    if (isSourceFile(normalizedPath)) {
      await processSourceEntry(entry, normalizedPath, projectName);
      continue;
    }

    if (normalizedPath.toLowerCase().endsWith('.umz')) {
      await processUmzEntry(entry, normalizedPath, projectName);
    }
  }

  if (fileCount === 0) {
    throw new UserError(`No source files found at project level ${level}.`, 422);
  }

  const projects = Array.from(projectMap.entries())
    .map(([name, files]) => ({
      name,
      files: files.sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
        return nameCompare !== 0 ? nameCompare : a.path.localeCompare(b.path, 'en', { sensitivity: 'base' });
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  return projects;
}

async function readEntryBuffer(entry, { maxBytes, tooLargeMessage, onChunk }) {
  const chunks = [];
  let size = 0;
  const stream = entry.stream();

  try {
    for await (const chunk of stream) {
      size += chunk.length;
      if (size > maxBytes) {
        throw new UserError(tooLargeMessage, 413);
      }
      if (onChunk) {
        onChunk(chunk.length);
      }
      chunks.push(chunk);
    }
  } catch (error) {
    stream.destroy();
    throw error;
  }

  return Buffer.concat(chunks, size);
}
