import './index.css';
import JSZip from 'jszip';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import clojure from 'highlight.js/lib/languages/clojure';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import dart from 'highlight.js/lib/languages/dart';
import delphi from 'highlight.js/lib/languages/delphi';
import elixir from 'highlight.js/lib/languages/elixir';
import erlang from 'highlight.js/lib/languages/erlang';
import fortran from 'highlight.js/lib/languages/fortran';
import go from 'highlight.js/lib/languages/go';
import groovy from 'highlight.js/lib/languages/groovy';
import haskell from 'highlight.js/lib/languages/haskell';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import lua from 'highlight.js/lib/languages/lua';
import markdown from 'highlight.js/lib/languages/markdown';
import matlab from 'highlight.js/lib/languages/matlab';
import perl from 'highlight.js/lib/languages/perl';
import php from 'highlight.js/lib/languages/php';
import plaintext from 'highlight.js/lib/languages/plaintext';
import powershell from 'highlight.js/lib/languages/powershell';
import python from 'highlight.js/lib/languages/python';
import r from 'highlight.js/lib/languages/r';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scala from 'highlight.js/lib/languages/scala';
import scss from 'highlight.js/lib/languages/scss';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import vbscript from 'highlight.js/lib/languages/vbscript';
import x86asm from 'highlight.js/lib/languages/x86asm';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { DEFAULT_FONT_ID, getFontById, getFontOptions } from '../shared/fonts.js';
import { DEFAULT_THEME_ID, getThemeOptions } from '../shared/themes.js';
import { applyHighlightTheme } from './theme-loader.js';
import { applyFilters, applyFiltersWithLineNumbers } from '../shared/filters.js';
import { getLanguageForExtension, isSourceFile } from '../shared/languages.js';
import { getDefaultLanguageFilters, getFiltersForLanguages } from '../shared/languageFilters.js';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('c', c);
hljs.registerLanguage('clojure', clojure);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('css', css);
hljs.registerLanguage('dart', dart);
hljs.registerLanguage('delphi', delphi);
hljs.registerLanguage('elixir', elixir);
hljs.registerLanguage('erlang', erlang);
hljs.registerLanguage('fortran', fortran);
hljs.registerLanguage('go', go);
hljs.registerLanguage('groovy', groovy);
hljs.registerLanguage('haskell', haskell);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('java', java);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('lua', lua);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('matlab', matlab);
hljs.registerLanguage('perl', perl);
hljs.registerLanguage('php', php);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('powershell', powershell);
hljs.registerLanguage('python', python);
hljs.registerLanguage('r', r);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('scala', scala);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('vbscript', vbscript);
hljs.registerLanguage('x86asm', x86asm);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('yaml', yaml);

const SETTINGS_STORAGE_KEY = 'jsp.settings';

function splitHighlightedLines(highlighted) {
  const lines = [];
  let current = '';
  const openTags = [];
  let index = 0;

  while (index < highlighted.length) {
    const char = highlighted[index];
    if (char === '<') {
      const closeIndex = highlighted.indexOf('>', index);
      if (closeIndex === -1) {
        current += highlighted.slice(index);
        break;
      }
      const tag = highlighted.slice(index, closeIndex + 1);
      const isClosing = /^<\s*\//.test(tag);
      const isSelfClosing = /\/\s*>$/.test(tag);
      const nameMatch = tag.match(/^<\s*\/?\s*([a-zA-Z0-9-]+)/);
      const tagName = nameMatch ? nameMatch[1] : null;

      if (tagName && !isClosing && !isSelfClosing) {
        openTags.push({ name: tagName, open: tag });
      } else if (tagName && isClosing) {
        const lastIndex = openTags.map((item) => item.name).lastIndexOf(tagName);
        if (lastIndex >= 0) {
          openTags.splice(lastIndex, 1);
        }
      }

      current += tag;
      index = closeIndex + 1;
      continue;
    }

    const nextTag = highlighted.indexOf('<', index);
    const text = nextTag === -1 ? highlighted.slice(index) : highlighted.slice(index, nextTag);
    const parts = text.split('\n');
    for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
      current += parts[partIndex];
      if (partIndex < parts.length - 1) {
        for (let closeIndex = openTags.length - 1; closeIndex >= 0; closeIndex -= 1) {
          current += `</${openTags[closeIndex].name}>`;
        }
        lines.push(current);
        current = '';
        for (let openIndex = 0; openIndex < openTags.length; openIndex += 1) {
          current += openTags[openIndex].open;
        }
      }
    }

    index = nextTag === -1 ? highlighted.length : nextTag;
  }

  lines.push(current);
  return lines;
}

const elements = {
  landing: document.querySelector('#landing'),
  app: document.querySelector('#app'),
  zipInput: document.querySelector('#zip-input'),
  zipInputApp: document.querySelector('#zip-input-app'),
  landingMeta: document.querySelector('#landing-meta'),
  landingUpload: document.querySelector('#landing-upload'),
  landingDemo: document.querySelector('#landing-demo'),
  landingStatus: document.querySelector('#landing-status'),
  zipMeta: document.querySelector('#zip-meta'),
  changeZip: document.querySelector('#change-zip'),
  fileCount: document.querySelector('#file-count'),
  fileList: document.querySelector('#file-list'),
  projectLevel: document.querySelector('#project-level'),
  fontSize: document.querySelector('#font-size'),
  fontSizeValue: document.querySelector('#font-size-value'),
  lineHeight: document.querySelector('#line-height'),
  lineHeightValue: document.querySelector('#line-height-value'),
  tabsToSpacesToggle: document.querySelector('#tabs-to-spaces-toggle'),
  themeSelect: document.querySelector('#theme-select'),
  fontSelect: document.querySelector('#font-select'),
  pageBreakSelect: document.querySelector('#page-break-select'),
  outputToggle: document.querySelector('#output-toggle'),
  headerProjectToggle: document.querySelector('#header-project-toggle'),
  headerFileToggle: document.querySelector('#header-file-toggle'),
  headerPathToggle: document.querySelector('#header-path-toggle'),
  footerPageToggle: document.querySelector('#footer-page-toggle'),
  lineNumbersToggle: document.querySelector('#line-numbers-toggle'),
  filterCommentsToggle: document.querySelector('#filter-comments-toggle'),
  filterBlankLinesToggle: document.querySelector('#filter-blanklines-toggle'),
  languageFilterSection: document.querySelector('#language-filter-section'),
  excludeFilesSection: document.querySelector('#exclude-files-section'),
  resetSettings: document.querySelector('#reset-settings'),
  helpModal: document.querySelector('#help-modal'),
  privacyModal: document.querySelector('#privacy-modal'),
  modalLinks: document.querySelectorAll('[data-modal-link]'),
  confirmDownloadModal: document.querySelector('#confirm-download-modal'),
  confirmDownload: document.querySelector('#confirm-download'),
  downloadBtn: document.querySelector('#download-btn'),
  status: document.querySelector('#status'),
  progressWrap: document.querySelector('#progress-wrap'),
  progressRing: document.querySelector('#progress-ring'),
  progressValue: document.querySelector('#progress-value'),
  previewTitle: document.querySelector('#preview-title'),
  previewMeta: document.querySelector('#preview-meta'),
  previewWrapper: document.querySelector('#preview-wrapper'),
  previewPre: document.querySelector('#preview-wrapper pre'),
  previewPageHeader: document.querySelector('#preview-page-header'),
  previewHeaderLeft: document.querySelector('#preview-header-left'),
  previewHeaderRight: document.querySelector('#preview-header-right'),
  previewPageFooter: document.querySelector('#preview-page-footer'),
  codeBlock: document.querySelector('#code-block'),
  downloadSpinner: document.querySelector('#download-spinner'),
};

const DEFAULT_SETTINGS = {
  fontSize: 12,
  lineHeight: 1.5,
  projectLevel: 1,
  tabsToSpaces: true,
  theme: DEFAULT_THEME_ID,
  fontFamily: DEFAULT_FONT_ID,
  pageBreakMultiple: 1,
  outputMode: 'per-project',
  highlighter: 'highlightjs',
  showProjectHeader: true,
  showFileHeader: true,
  showFilePath: false,
  showPageNumbers: true,
  showLineNumbers: false,
  removeComments: false,
  collapseBlankLines: true,
  languageFilters: getDefaultLanguageFilters(),
};

function createDefaultSettings() {
  return {
    ...DEFAULT_SETTINGS,
    languageFilters: Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS.languageFilters).map(([language, filters]) => [language, { ...filters }]),
    ),
  };
}

const state = {
  zipFile: null,
  pendingFile: null,
  demoMode: false,
  projects: [],
  selectedFileId: null,
  fileIndex: new Map(),
  isLoading: false,
  settings: createDefaultSettings(),
};

let activeEventSource = null;

const modalMap = {
  help: elements.helpModal,
  privacy: elements.privacyModal,
};

function openModal(key, updateHash = true) {
  const checkbox = modalMap[key];
  if (!checkbox) return;
  if (elements.confirmDownloadModal?.checked) {
    elements.confirmDownloadModal.checked = false;
  }
  checkbox.checked = true;
  if (updateHash) {
    const hash = `#${key}`;
    if (location.hash !== hash) {
      location.hash = hash;
    }
  }
}

function closeAllModals() {
  Object.values(modalMap).forEach((checkbox) => {
    if (checkbox) checkbox.checked = false;
  });
}

function syncModalFromHash() {
  const key = location.hash.replace('#', '');
  if (modalMap[key]) {
    openModal(key, false);
    return;
  }
  closeAllModals();
}

function loadStoredSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    // Migrate flat Java filter settings to nested languageFilters shape.
    if (parsed.removeJavadoc !== undefined || parsed.hideInitComponents !== undefined || parsed.hideMain !== undefined) {
      parsed.languageFilters = parsed.languageFilters ?? {};
      parsed.languageFilters.java = parsed.languageFilters.java ?? {};
      if (parsed.removeJavadoc !== undefined) parsed.languageFilters.java.removeJavadoc = parsed.removeJavadoc;
      if (parsed.hideInitComponents !== undefined) parsed.languageFilters.java.hideInitComponents = parsed.hideInitComponents;
      if (parsed.hideMain !== undefined) parsed.languageFilters.java.hideMain = parsed.hideMain;
      delete parsed.removeJavadoc;
      delete parsed.hideInitComponents;
      delete parsed.hideMain;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

function saveStoredSettings() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state.settings));
  } catch (_error) {
    // Ignore localStorage failures.
  }
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle('text-error', isError);
}

function setLandingStatus(message, isError = false) {
  elements.landingStatus.textContent = message;
  elements.landingStatus.classList.toggle('text-error', isError);
}

function showLanding() {
  elements.landing.classList.remove('hidden');
  elements.app.classList.add('hidden');
}

function showApp() {
  elements.landing.classList.add('hidden');
  elements.app.classList.remove('hidden');
}

function hasIncludedFiles() {
  return state.projects.some((project) => project.files.some((file) => file.included !== false));
}

function updateDownloadButtonState() {
  elements.downloadBtn.disabled = state.isLoading || !state.zipFile || !hasIncludedFiles();
}

function setLoading(isLoading) {
  state.isLoading = isLoading;
  elements.downloadSpinner.classList.toggle('hidden', !isLoading);
  updateDownloadButtonState();
}

function showProgress() {
  elements.progressWrap.classList.remove('hidden');
}

function hideProgress() {
  elements.progressWrap.classList.add('hidden');
}

function updateProgress(completed, total) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  elements.progressRing.style.setProperty('--value', percent);
  elements.progressValue.textContent = `${percent}%`;
}

function closeEventSource() {
  if (activeEventSource) {
    activeEventSource.close();
    activeEventSource = null;
  }
}

function updateCounts() {
  const totalFiles = state.projects.reduce((sum, project) => sum + project.files.length, 0);
  const projectCount = state.projects.length;
  elements.fileCount.textContent = `${totalFiles} file${totalFiles === 1 ? '' : 's'} / ${projectCount} project${projectCount === 1 ? '' : 's'}`;
}

function updatePreviewFontSize() {
  elements.codeBlock.style.fontSize = `${state.settings.fontSize}px`;
}

function updatePreviewLineHeight() {
  elements.codeBlock.style.lineHeight = `${state.settings.lineHeight}`;
}

function updatePreviewFontFamily() {
  const font = getFontById(state.settings.fontFamily);
  elements.codeBlock.style.fontFamily = font.css;
}

function updatePreviewHeaderFooter() {
  const selection = state.fileIndex.get(state.selectedFileId);
  const { showProjectHeader, showFileHeader, showFilePath, showPageNumbers, fontSize, lineHeight } = state.settings;
  const font = getFontById(state.settings.fontFamily);

  elements.previewPageHeader.style.display = 'flex';
  const headerFontSize = Math.max(8, fontSize - 1);
  elements.previewPageHeader.style.fontSize = `${headerFontSize}px`;
  elements.previewPageHeader.style.lineHeight = String(lineHeight);
  elements.previewPageHeader.style.fontFamily = font.css;
  elements.previewHeaderLeft.textContent = showProjectHeader && selection ? selection.project.name : '';
  if (showFileHeader && selection) {
    elements.previewHeaderRight.textContent = showFilePath
      ? (selection.file.path ?? selection.file.name)
      : selection.file.name;
    elements.previewHeaderRight.style.overflow = showFilePath ? '' : 'hidden';
    elements.previewHeaderRight.style.textOverflow = showFilePath ? '' : 'ellipsis';
    elements.previewHeaderRight.style.whiteSpace = showFilePath ? 'normal' : 'nowrap';
    elements.previewHeaderRight.style.overflowWrap = showFilePath ? 'anywhere' : '';
    elements.previewHeaderRight.style.wordBreak = showFilePath ? 'break-word' : '';
  } else {
    elements.previewHeaderRight.textContent = '';
    elements.previewHeaderRight.style.overflow = '';
    elements.previewHeaderRight.style.textOverflow = '';
    elements.previewHeaderRight.style.whiteSpace = '';
    elements.previewHeaderRight.style.overflowWrap = '';
    elements.previewHeaderRight.style.wordBreak = '';
  }

  elements.previewPageFooter.style.display = 'block';
  elements.previewPageFooter.style.fontSize = `${fontSize}px`;
  elements.previewPageFooter.style.lineHeight = String(lineHeight);
  elements.previewPageFooter.style.fontFamily = font.css;
  elements.previewPageFooter.textContent = showPageNumbers ? 'Page 1' : '';

  elements.previewPre.style.paddingTop = '0';
  elements.previewPre.style.paddingBottom = '0';
}

async function reloadZipProjects() {
  if (!state.zipFile) return;
  setLoading(true);
  setStatus('Reading zip file...');
  try {
    const projects = await parseZip(state.zipFile, state.settings.projectLevel);
    applyProjects(state.zipFile, projects);
    if (projects.length === 0) {
      setStatus(`No source files found at project level ${state.settings.projectLevel}.`);
    } else {
      setStatus('Preview ready.');
    }
  } catch (_error) {
    setStatus('Failed to read the zip. Please check the file format.', true);
  } finally {
    setLoading(false);
  }
}

function syncHeaderPathToggle() {
  const canShowPath = state.settings.showFileHeader;
  elements.headerPathToggle.disabled = !canShowPath;
  if (!canShowPath) {
    state.settings.showFilePath = false;
    elements.headerPathToggle.checked = false;
  }
}

function applySettingsToControls() {
  elements.projectLevel.value = state.settings.projectLevel;
  elements.fontSize.value = state.settings.fontSize;
  elements.fontSizeValue.textContent = `${state.settings.fontSize} px`;
  elements.lineHeight.value = state.settings.lineHeight;
  elements.lineHeightValue.textContent = `${state.settings.lineHeight}`;
  elements.tabsToSpacesToggle.checked = state.settings.tabsToSpaces;
  elements.themeSelect.value = state.settings.theme;
  elements.fontSelect.value = state.settings.fontFamily;
  elements.pageBreakSelect.value = String(state.settings.pageBreakMultiple);
  elements.outputToggle.checked = state.settings.outputMode === 'single';
  elements.headerProjectToggle.checked = state.settings.showProjectHeader;
  elements.headerFileToggle.checked = state.settings.showFileHeader;
  elements.headerPathToggle.checked = state.settings.showFilePath;
  elements.footerPageToggle.checked = state.settings.showPageNumbers;
  elements.lineNumbersToggle.checked = state.settings.showLineNumbers;
  elements.filterCommentsToggle.checked = state.settings.removeComments;
  elements.filterBlankLinesToggle.checked = state.settings.collapseBlankLines;
  syncHeaderPathToggle();
  renderLanguageFilters();
  updatePreviewHeaderFooter();
}

function renderLanguageFilters() {
  if (!elements.languageFilterSection) return;

  const detectedLanguageIds = [
    ...new Set(state.projects.flatMap((p) => p.files.map((f) => f.language).filter(Boolean))),
  ];
  const groups = getFiltersForLanguages(detectedLanguageIds);

  if (groups.length === 0) {
    elements.languageFilterSection.innerHTML = '';
    return;
  }

  const html = groups
    .map(({ language, languageLabel, filters }) => {
      const rows = filters
        .map(({ id, label }) => {
          const checked = Boolean(state.settings.languageFilters?.[language]?.[id]);
          return `
            <div class="form-control">
              <label class="label cursor-pointer gap-2 justify-start">
                <input type="checkbox" class="toggle toggle-xs toggle-primary"
                  data-lang-filter-lang="${language}" data-lang-filter-id="${id}"
                  ${checked ? 'checked' : ''} />
                <span class="label-text">${label}</span>
              </label>
            </div>`;
        })
        .join('');
      return `<div class="mt-2"><p class="text-xs font-semibold text-base-content/60 mb-1">${languageLabel} filters</p>${rows}</div>`;
    })
    .join('');

  elements.languageFilterSection.innerHTML = html;

  elements.languageFilterSection.querySelectorAll('[data-lang-filter-lang]').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const lang = event.target.dataset.langFilterLang;
      const filterId = event.target.dataset.langFilterId;
      setSettings({ languageFilters: { [lang]: { [filterId]: event.target.checked } } });
    });
  });
}

function getFilenameGroups() {
  const groups = new Map();

  for (const project of state.projects) {
    for (const file of project.files) {
      const name = file.name || file.path || 'Unnamed file';
      if (!groups.has(name)) {
        groups.set(name, { name, files: [] });
      }
      groups.get(name).files.push(file);
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    const baseCompare = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    return baseCompare || a.name.localeCompare(b.name, 'en');
  });
}

function renderExcludeFiles() {
  if (!elements.excludeFilesSection) return;

  elements.excludeFilesSection.innerHTML = '';
  const groups = getFilenameGroups();

  if (groups.length === 0) {
    elements.excludeFilesSection.innerHTML =
      '<p class="text-xs text-base-content/60">Upload a zip to see detected filenames.</p>';
    return;
  }

  const list = document.createElement('div');
  list.className = 'grid gap-1';

  for (const group of groups) {
    const includedCount = group.files.filter((file) => file.included !== false).length;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'checkbox checkbox-xs checkbox-primary shrink-0';
    checkbox.checked = includedCount === group.files.length;
    checkbox.indeterminate = includedCount > 0 && includedCount < group.files.length;
    checkbox.addEventListener('change', (event) => {
      group.files.forEach((file) => {
        file.included = event.target.checked;
      });
      renderFileList();
      renderExcludeFiles();
      updateDownloadButtonState();
    });

    const name = document.createElement('span');
    name.className = 'min-w-0 flex-1 truncate text-xs text-base-content/80';
    name.textContent = group.name;
    name.title = group.name;

    const count = document.createElement('span');
    count.className = 'shrink-0 text-[0.6875rem] text-base-content/50';
    count.textContent = `${group.files.length} file${group.files.length === 1 ? '' : 's'}`;

    const row = document.createElement('label');
    row.className = 'flex min-w-0 cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-base-300/60';
    row.appendChild(checkbox);
    row.appendChild(name);
    row.appendChild(count);
    list.appendChild(row);
  }

  elements.excludeFilesSection.appendChild(list);
}

function renderFileList() {
  elements.fileList.innerHTML = '';
  state.fileIndex.clear();

  if (state.projects.length === 0) {
    elements.fileList.innerHTML = '<p class="text-xs text-base-content/60">Upload a zip to see your source files.</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'table table-pin-rows table-pin-cols w-full table-xs sm:table-sm table-fixed';

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th class="w-1/4">Project</th>
      <th class="w-1/4">File</th>
      <th class="w-1/2">Path</th>
    </tr>
  `;

  const tbody = document.createElement('tbody');

  for (const project of state.projects) {
    project.files.forEach((file, index) => {
      const fileId = `${project.name}:::${file.path}`;
      state.fileIndex.set(fileId, { project, file });

      const row = document.createElement('tr');
      row.dataset.fileId = fileId;
      row.className = 'cursor-pointer';
      const isSelected = fileId === state.selectedFileId;

      if (index === 0) {
        const projectCell = document.createElement('td');
        projectCell.className = 'font-medium align-top';
        projectCell.textContent = project.name;
        projectCell.rowSpan = project.files.length;
        projectCell.dataset.projectCell = project.name;
        row.appendChild(projectCell);
      }

      const fileCell = document.createElement('td');
      fileCell.className = 'align-top';

      const label = document.createElement('label');
      label.className = 'label cursor-pointer justify-start gap-2';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'checkbox checkbox-xs checkbox-primary';
      checkbox.checked = file.included !== false;
      checkbox.addEventListener('change', (event) => {
        file.included = event.target.checked;
        renderExcludeFiles();
        updateDownloadButtonState();
      });
      checkbox.addEventListener('click', (event) => {
        event.stopPropagation();
      });

      label.addEventListener('click', (event) => {
        if (event.target !== checkbox) {
          event.preventDefault();
        }
      });

      const nameSpan = document.createElement('span');
      nameSpan.className = 'label-text truncate';
      nameSpan.textContent = file.name;
      nameSpan.title = file.name;

      label.appendChild(checkbox);
      label.appendChild(nameSpan);
      fileCell.appendChild(label);
      if (isSelected) {
        fileCell.classList.add('bg-primary/10');
      }

      const pathCell = document.createElement('td');
      pathCell.className = 'text-xs text-base-content/60 truncate';
      pathCell.title = file.path;
      pathCell.textContent = file.path;
      if (isSelected) {
        pathCell.classList.add('bg-primary/10');
      }

      row.appendChild(fileCell);
      row.appendChild(pathCell);
      tbody.appendChild(row);
    });
  }

  table.appendChild(thead);
  table.appendChild(tbody);
  elements.fileList.appendChild(table);

  if (state.selectedFileId) {
    const selectedProject = state.fileIndex.get(state.selectedFileId)?.project?.name;
    if (selectedProject) {
      const projectCell = table.querySelector(`td[data-project-cell="${CSS.escape(selectedProject)}"]`);
      if (projectCell) {
        projectCell.classList.add('bg-primary/10');
      }
    }
  }
}

function renderPreview() {
  const selection = state.fileIndex.get(state.selectedFileId);
  if (!selection) {
    elements.previewTitle.textContent = 'Select a file';
    elements.previewMeta.textContent = '';
    elements.codeBlock.textContent = '';
    updatePreviewHeaderFooter();
    return;
  }

  elements.previewTitle.textContent = selection.file.name;
  elements.previewMeta.textContent = selection.project.name;

  const language = selection.file.language ?? 'plaintext';
  const fileSettings = { ...state.settings, language };

  if (state.settings.showLineNumbers) {
    const { lines, maxLineNumber } = applyFiltersWithLineNumbers(selection.file.content, fileSettings);
    const filteredContent = lines.map((line) => line.text).join('\n');
    const lang = hljs.getLanguage(language) ? language : 'plaintext';
    const highlighted = hljs.highlight(filteredContent, { language: lang }).value;
    const highlightedLines = splitHighlightedLines(highlighted);
    const numberWidth = String(maxLineNumber).length;
    const numberedHtml = highlightedLines
      .map((line, index) => {
        const lineNumber = lines[index]?.number ?? '';
        const content = line.length ? line : '&nbsp;';
        return `<span class="code-line"><span class="line-number">${lineNumber}</span><span class="line-content">${content}</span></span>`;
      })
      .join('');
    elements.codeBlock.className = `hljs language-${language} line-numbers`;
    elements.codeBlock.style.setProperty('--line-number-width', `${numberWidth}ch`);
    elements.codeBlock.innerHTML = numberedHtml;
  } else {
    const filteredContent = applyFilters(selection.file.content, fileSettings);
    const lang = hljs.getLanguage(language) ? language : 'plaintext';
    const highlighted = hljs.highlight(filteredContent, { language: lang }).value;
    elements.codeBlock.className = `hljs language-${language}`;
    elements.codeBlock.style.removeProperty('--line-number-width');
    elements.codeBlock.innerHTML = highlighted;
  }
  updatePreviewFontSize();
  updatePreviewLineHeight();
  updatePreviewFontFamily();
  updatePreviewHeaderFooter();
}

function setSettings({
  projectLevel,
  fontSize,
  lineHeight,
  tabsToSpaces,
  theme,
  fontFamily,
  pageBreakMultiple,
  outputMode,
  highlighter,
  showProjectHeader,
  showFileHeader,
  showFilePath,
  showPageNumbers,
  showLineNumbers,
  removeComments,
  collapseBlankLines,
  languageFilters,
}) {
  let needsPreviewRefresh = false;
  if (Number.isFinite(projectLevel)) {
    state.settings.projectLevel = projectLevel;
  }
  if (fontSize) {
    state.settings.fontSize = fontSize;
    elements.fontSizeValue.textContent = `${fontSize} px`;
    updatePreviewFontSize();
  }
  if (lineHeight) {
    state.settings.lineHeight = lineHeight;
    elements.lineHeightValue.textContent = `${lineHeight}`;
    updatePreviewLineHeight();
  }
  if (typeof tabsToSpaces === 'boolean') {
    state.settings.tabsToSpaces = tabsToSpaces;
    needsPreviewRefresh = true;
  }
  if (theme) {
    state.settings.theme = theme;
    applyHighlightTheme(theme);
    needsPreviewRefresh = true;
  }
  if (fontFamily) {
    state.settings.fontFamily = fontFamily;
    updatePreviewFontFamily();
  }
  if (Number.isFinite(pageBreakMultiple)) {
    state.settings.pageBreakMultiple = pageBreakMultiple;
  }
  if (outputMode) {
    state.settings.outputMode = outputMode;
  }
  if (highlighter) {
    state.settings.highlighter = highlighter;
  }
  if (typeof showProjectHeader === 'boolean') {
    state.settings.showProjectHeader = showProjectHeader;
  }
  if (typeof showFileHeader === 'boolean') {
    state.settings.showFileHeader = showFileHeader;
  }
  if (typeof showFilePath === 'boolean') {
    if (state.settings.showFileHeader) {
      state.settings.showFilePath = showFilePath;
    } else {
      state.settings.showFilePath = false;
    }
  }
  syncHeaderPathToggle();
  if (typeof showPageNumbers === 'boolean') {
    state.settings.showPageNumbers = showPageNumbers;
  }
  if (typeof showLineNumbers === 'boolean') {
    state.settings.showLineNumbers = showLineNumbers;
    needsPreviewRefresh = true;
  }
  if (typeof removeComments === 'boolean') {
    state.settings.removeComments = removeComments;
    needsPreviewRefresh = true;
  }
  if (typeof collapseBlankLines === 'boolean') {
    state.settings.collapseBlankLines = collapseBlankLines;
    needsPreviewRefresh = true;
  }
  if (languageFilters && typeof languageFilters === 'object') {
    state.settings.languageFilters = { ...state.settings.languageFilters };
    for (const [lang, filters] of Object.entries(languageFilters)) {
      state.settings.languageFilters[lang] = { ...(state.settings.languageFilters[lang] ?? {}), ...filters };
    }
    needsPreviewRefresh = true;
  }

  if (needsPreviewRefresh) {
    renderPreview();
  } else {
    updatePreviewHeaderFooter();
  }

  saveStoredSettings();
}

async function parseZip(file, projectLevel = state.settings.projectLevel) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const projectMap = new Map();
  const level = Math.min(3, Math.max(1, Number(projectLevel) || 1));

  function shouldIgnorePath(normalizedPath) {
    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.length === 0) return true;
    if (segments.some((segment) => segment.toLowerCase() === '__macosx')) return true;
    const fileName = segments[segments.length - 1];
    return fileName.startsWith('.');
  }

  function addSourceFile(projectName, filePath, content) {
    if (!projectMap.has(projectName)) {
      projectMap.set(projectName, []);
    }

    const segments = filePath.split('/').filter(Boolean);
    const fileName = segments[segments.length - 1] || filePath;
    projectMap.get(projectName).push({
      name: fileName,
      path: filePath,
      content,
      language: getLanguageForExtension(filePath) ?? 'plaintext',
      included: true,
    });
  }

  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    const normalizedPath = entry.name.replace(/\\/g, '/');
    if (normalizedPath.startsWith('/') || normalizedPath.includes('..')) continue;
    if (shouldIgnorePath(normalizedPath)) continue;

    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.length < level + 1) continue;
    const projectName = segments[level - 1];

    if (isSourceFile(normalizedPath)) {
      const content = await entry.async('text');
      addSourceFile(projectName, normalizedPath, content);
      continue;
    }

    if (!normalizedPath.toLowerCase().endsWith('.umz')) {
      continue;
    }

    let nestedZip;
    try {
      nestedZip = await JSZip.loadAsync(await entry.async('arraybuffer'));
    } catch (_error) {
      continue;
    }

    const nestedEntries = Object.values(nestedZip.files);
    for (const nestedEntry of nestedEntries) {
      if (nestedEntry.dir) continue;
      const nestedPath = nestedEntry.name.replace(/\\/g, '/');
      if (!isSourceFile(nestedPath)) continue;
      if (nestedPath.startsWith('/') || nestedPath.includes('..')) continue;
      if (shouldIgnorePath(nestedPath)) continue;

      const content = await nestedEntry.async('text');
      const combinedPath = `${normalizedPath}/${nestedPath}`;
      addSourceFile(projectName, combinedPath, content);
    }
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

function applyProjects(file, projects) {
  state.zipFile = file;
  state.projects = projects;
  state.demoMode = false;
  resetLandingSelection();
  state.selectedFileId = projects[0]?.files[0]
    ? `${projects[0].name}:::${projects[0].files[0].path}`
    : null;

  elements.zipMeta.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
  updateCounts();
  renderLanguageFilters();
  renderExcludeFiles();
  renderFileList();
  renderPreview();
  updateDownloadButtonState();
}

function resetLandingSelection() {
  state.pendingFile = null;
  elements.landingMeta.textContent = 'No file selected.';
  elements.landingUpload.disabled = true;
}

function updateLandingSelection(file) {
  state.pendingFile = file;
  elements.landingMeta.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
  elements.landingUpload.disabled = false;
}

function handleLandingZipChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    resetLandingSelection();
    return;
  }
  updateLandingSelection(file);
  setLandingStatus('');
}

function getDemoProjects() {
  return [
    {
      name: 'demo-app',
      files: [
        {
          name: 'Main.java',
          path: 'demo-app/src/Main.java',
          content: `package demo.app;\n\npublic class Main {\n  /**\n   * Entry point for demo-app.\n   */\n  public static void main(String[] args) {\n    System.out.println(\"Hello from demo-app\");\n  }\n}\n`,
          included: true,
        },
        {
          name: 'Config.java',
          path: 'demo-app/src/Config.java',
          content: `package demo.app;\n\npublic final class Config {\n  public static final String ENV = \"dev\";\n\n  // Feature flags\n  public static final boolean ENABLE_METRICS = true;\n\n  /*\n   * Multi-line comment to demonstrate filtering.\n   */\n  public static final int MAX_RETRIES = 3;\n\n  private Config() {}\n}\n`,
          included: true,
        },
        {
          name: 'Startup.java',
          path: 'demo-app/src/Startup.java',
          content: `package demo.app;\n\npublic final class Startup {\n  private Startup() {}\n\n  public static boolean ready() {\n    return true;\n  }\n}\n`,
          included: false,
        },
      ],
    },
    {
      name: 'demo-lib',
      files: [
        {
          name: 'MathUtils.java',
          path: 'demo-lib/src/MathUtils.java',
          content: `package demo.lib;\n\npublic final class MathUtils {\n\tprivate MathUtils() {}\n\n\tpublic static int multiply(int a, int b) {\n\t\treturn a * b;\n\t}\n}\n`,
          included: true,
        },
        {
          name: 'CollectionUtils.java',
          path: 'demo-lib/src/CollectionUtils.java',
          content: `package demo.lib;\n\nimport java.util.List;\n\npublic final class CollectionUtils {\n  private CollectionUtils() {}\n\n  public static boolean isEmpty(List<?> list) {\n    return list == null || list.isEmpty();\n  }\n}\n`,
          included: true,
        },
        {
          name: 'Library.java',
          path: 'demo-lib/src/Library.java',
          content: `package demo.lib;\n\npublic class Library {\n  public String version() {\n    return \"1.0.0\";\n  }\n}\n`,
          included: true,
        },
        {
          name: 'Main.java',
          path: 'demo-lib/examples/Main.java',
          content: `package demo.lib.examples;\n\nimport demo.lib.Library;\n\npublic class Main {\n  public static void main(String[] args) {\n    System.out.println(new Library().version());\n  }\n}\n`,
          included: true,
        },
      ],
    },
    {
      name: 'demo-service',
      files: [
        {
          name: 'Config.java',
          path: 'demo-service/config/Config.java',
          content: `package demo.service.config;\n\npublic final class Config {\n  public static final String API_BASE = \"https://example.test\";\n  public static final int TIMEOUT_SECONDS = 10;\n\n  private Config() {}\n}\n`,
          included: false,
        },
        {
          name: 'ApiClient.java',
          path: 'demo-service/src/ApiClient.java',
          content: `package demo.service;\n\npublic class ApiClient {\n  /**\n   * Fetches data from the service.\n   */\n  public String fetch(String endpoint) {\n    return \"ok\";\n  }\n}\n`,
          included: true,
        },
        {
          name: 'RetryPolicy.java',
          path: 'demo-service/src/RetryPolicy.java',
          content: `package demo.service;\n\npublic final class RetryPolicy {\n  private final int maxAttempts;\n\n  public RetryPolicy(int maxAttempts) {\n    this.maxAttempts = maxAttempts;\n  }\n\n  public boolean shouldRetry(int attempt) {\n    return attempt < maxAttempts;\n  }\n}\n`,
          included: true,
        },
        {
          name: 'ServiceStatus.java',
          path: 'demo-service/src/ServiceStatus.java',
          content: `package demo.service;\n\npublic enum ServiceStatus {\n  STARTING,\n  RUNNING,\n  STOPPED\n}\n`,
          included: true,
        },
        {
          name: 'Main.java',
          path: 'demo-service/src/bootstrap/Main.java',
          content: `package demo.service.bootstrap;\n\npublic class Main {\n  public static void main(String[] args) {\n    System.out.println(\"Starting demo service\");\n  }\n}\n`,
          included: true,
        },
      ],
    },
    {
      name: 'demo-ui',
      files: [
        {
          name: 'Config.java',
          path: 'demo-ui/resources/generated/Config.java',
          content: `package demo.ui.generated;\n\npublic final class Config {\n  public static final String THEME = \"light\";\n  public static final boolean SHOW_TOOLBAR = true;\n\n  private Config() {}\n}\n`,
          included: true,
        },
        {
          name: 'MainFrame.java',
          path: 'demo-ui/src/MainFrame.java',
          content: `package demo.ui;\n\npublic class MainFrame {\n  private void initComponents() {\n    // UI components would be configured here.\n    javax.swing.JButton button = new javax.swing.JButton();\n    button.setText(\"OK\");\n  }\n}\n`,
          included: false,
        },
        {
          name: 'Theme.java',
          path: 'demo-ui/src/Theme.java',
          content: `package demo.ui;\n\npublic final class Theme {\n  public static final String PRIMARY = \"#0f766e\";\n\n  private Theme() {}\n}\n`,
          included: true,
        },
      ],
    },
  ];
}

async function handleLandingUpload() {
  if (!state.pendingFile) {
    setLandingStatus('Select a zip before uploading.', true);
    return;
  }

  elements.landingUpload.disabled = true;
  setLandingStatus('Reading zip file...');
  try {
    const projects = await parseZip(state.pendingFile, state.settings.projectLevel);
    applyProjects(state.pendingFile, projects);
    showApp();
    setLandingStatus('');
    if (projects.length === 0) {
      setStatus(`No source files found at project level ${state.settings.projectLevel}.`);
    } else {
      setStatus('Preview ready.');
    }
  } catch (_error) {
    setLandingStatus('Failed to read the zip. Please check the file format.', true);
  } finally {
    elements.landingUpload.disabled = !state.pendingFile;
  }
}

async function handleAppZipChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  setLoading(true);
  setStatus('Reading zip file...');
  try {
    const projects = await parseZip(file, state.settings.projectLevel);
    applyProjects(file, projects);
    if (projects.length === 0) {
      setStatus(`No source files found at project level ${state.settings.projectLevel}.`);
    } else {
      setStatus('Preview ready.');
    }
  } catch (_error) {
    setStatus('Failed to read the zip. Please check the file format.', true);
  } finally {
    event.target.value = '';
    setLoading(false);
  }
}

function handleChangeZipClick() {
  elements.zipInputApp.click();
}

function handleDemoMode() {
  const projects = getDemoProjects().map((project) => ({
    ...project,
    files: project.files.map((file) => ({
      ...file,
      language: file.language ?? getLanguageForExtension(file.path) ?? 'plaintext',
    })),
  }));
  state.zipFile = null;
  state.demoMode = true;
  state.projects = projects;
  state.selectedFileId = projects[0]?.files[0]
    ? `${projects[0].name}:::${projects[0].files[0].path}`
    : null;

  elements.zipMeta.textContent = 'Demo mode';
  updateCounts();
  renderLanguageFilters();
  renderExcludeFiles();
  renderFileList();
  renderPreview();
  updateDownloadButtonState();
  setStatus('Demo mode: upload a zip to generate PDFs.');
  showApp();
}

function handleFileListClick(event) {
  if (event.target.closest('input[type="checkbox"]')) {
    return;
  }
  const row = event.target.closest('tr[data-file-id]');
  if (!row) return;
  state.selectedFileId = row.dataset.fileId;
  renderFileList();
  renderPreview();
}

async function handleDownload() {
  if (!state.zipFile) return;
  setLoading(true);
  setStatus('Starting render...');
  showProgress();
  updateProgress(0, 0);
  closeEventSource();

  try {
    const includedFiles = [];
    state.projects.forEach((project) => {
      project.files.forEach((file) => {
        if (file.included !== false) {
          includedFiles.push(file.path);
        }
      });
    });

    if (includedFiles.length === 0) {
      setStatus('Select at least one file to generate PDFs.', true);
      setLoading(false);
      hideProgress();
      return;
    }

    const formData = new FormData();
    formData.append('zip', state.zipFile, state.zipFile.name);
    formData.append(
      'settings',
      JSON.stringify({
        ...state.settings,
        includedFiles,
      }),
    );

    const response = await fetch('/api/render/start', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = 'Failed to start render.';
      try {
        const payload = await response.json();
        if (payload?.error) errorMessage = payload.error;
      } catch (_err) {
        // Ignore parse errors.
      }
      throw new Error(errorMessage);
    }

    const payload = await response.json();
    const jobId = payload?.jobId;
    if (!jobId) {
      throw new Error('Render job was not created.');
    }

    activeEventSource = new EventSource(`/api/render/progress/${jobId}`);

    activeEventSource.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse(event.data);
        updateProgress(data.completed, data.total);
      } catch (_error) {
        // Ignore parse errors.
      }
    });

    activeEventSource.addEventListener('done', async () => {
      closeEventSource();
      try {
        await downloadJob(jobId);
        setStatus('Download started.');
      } catch (error) {
        setStatus(error.message || 'Download failed.', true);
      } finally {
        setLoading(false);
        hideProgress();
      }
    });

    activeEventSource.addEventListener('failed', (event) => {
      let message = 'Render failed.';
      try {
        const data = JSON.parse(event.data);
        if (data?.error) message = data.error;
      } catch (_error) {
        // Ignore parse errors.
      }
      setStatus(message, true);
      closeEventSource();
      setLoading(false);
      hideProgress();
    });

    activeEventSource.addEventListener('error', () => {
      setStatus('Lost connection to render progress.', true);
      closeEventSource();
      setLoading(false);
      hideProgress();
    });
  } catch (error) {
    setStatus(error.message || 'Download failed.', true);
    closeEventSource();
    setLoading(false);
    hideProgress();
  } finally {
    // handled in SSE callbacks
  }
}

async function downloadJob(jobId) {
  const response = await fetch(`/api/render/download/${jobId}`);
  if (!response.ok) {
    let errorMessage = 'Failed to download PDF.';
    try {
      const payload = await response.json();
      if (payload?.error) errorMessage = payload.error;
    } catch (_err) {
      // Ignore parse errors.
    }
    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  const fallbackName = getFallbackFilename();
  const downloadName = getFilenameFromDisposition(response.headers.get('content-disposition')) || fallbackName;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = downloadName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function getFilenameFromDisposition(value) {
  if (!value) return null;
  const match = value.match(/filename="([^"]+)"/i);
  return match ? match[1] : null;
}

function getFallbackFilename() {
  const base = state.zipFile?.name?.replace(/\.zip$/i, '') || 'source-output';
  return state.settings.outputMode === 'single' ? `${base}.pdf` : `${base}.zip`;
}

function setupThemeOptions() {
  const options = getThemeOptions();
  elements.themeSelect.innerHTML = options
    .map((option) => `<option value="${option.id}">${option.label}</option>`)
    .join('');
  elements.themeSelect.value = state.settings.theme;
}

function setupFontOptions() {
  const options = getFontOptions();
  elements.fontSelect.innerHTML = options
    .map((option) => `<option value="${option.id}">${option.label}</option>`)
    .join('');
  elements.fontSelect.value = state.settings.fontFamily;
}

elements.zipInput.addEventListener('change', handleLandingZipChange);
elements.landingUpload.addEventListener('click', handleLandingUpload);
elements.landingDemo.addEventListener('click', handleDemoMode);
elements.zipInputApp.addEventListener('change', handleAppZipChange);
elements.changeZip.addEventListener('click', handleChangeZipClick);
elements.fileList.addEventListener('click', handleFileListClick);
elements.downloadBtn.addEventListener('click', () => {
  if (elements.downloadBtn.disabled) return;
  elements.confirmDownloadModal.checked = true;
});
elements.confirmDownload.addEventListener('click', () => {
  elements.confirmDownloadModal.checked = false;
  handleDownload();
});

elements.projectLevel.addEventListener('input', async (event) => {
  const projectLevel = Number(event.target.value);
  setSettings({ projectLevel });
  await reloadZipProjects();
});

elements.fontSize.addEventListener('input', (event) => {
  setSettings({ fontSize: Number(event.target.value) });
});

elements.lineHeight.addEventListener('input', (event) => {
  setSettings({ lineHeight: Number(event.target.value) });
});

elements.tabsToSpacesToggle.addEventListener('change', (event) => {
  setSettings({ tabsToSpaces: event.target.checked });
});

elements.themeSelect.addEventListener('change', (event) => {
  setSettings({ theme: event.target.value });
});

elements.fontSelect.addEventListener('change', (event) => {
  setSettings({ fontFamily: event.target.value });
});

elements.pageBreakSelect.addEventListener('change', (event) => {
  setSettings({ pageBreakMultiple: Number(event.target.value) });
});

elements.outputToggle.addEventListener('change', (event) => {
  setSettings({ outputMode: event.target.checked ? 'single' : 'per-project' });
});

elements.headerProjectToggle.addEventListener('change', (event) => {
  setSettings({ showProjectHeader: event.target.checked });
});

elements.headerFileToggle.addEventListener('change', (event) => {
  setSettings({ showFileHeader: event.target.checked });
});

elements.headerPathToggle.addEventListener('change', (event) => {
  setSettings({ showFilePath: event.target.checked });
});

elements.footerPageToggle.addEventListener('change', (event) => {
  setSettings({ showPageNumbers: event.target.checked });
});

elements.lineNumbersToggle.addEventListener('change', (event) => {
  setSettings({ showLineNumbers: event.target.checked });
});

elements.filterCommentsToggle.addEventListener('change', (event) => {
  setSettings({ removeComments: event.target.checked });
});

elements.filterBlankLinesToggle.addEventListener('change', (event) => {
  setSettings({ collapseBlankLines: event.target.checked });
});

elements.resetSettings.addEventListener('click', () => {
  state.settings = createDefaultSettings();
  setSettings(state.settings);
  applySettingsToControls();
  document.querySelector('#reset-modal').checked = false;
  void reloadZipProjects();
});

elements.modalLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const key = link.dataset.modalLink;
    openModal(key);
  });
});

elements.helpModal.addEventListener('change', () => {
  if (!elements.helpModal.checked && location.hash === '#help') {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }
});

elements.privacyModal.addEventListener('change', () => {
  if (!elements.privacyModal.checked && location.hash === '#privacy') {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }
});

window.addEventListener('hashchange', syncModalFromHash);

setupThemeOptions();
setupFontOptions();
const storedSettings = loadStoredSettings();
if (storedSettings) {
  const mergedLanguageFilters = createDefaultSettings().languageFilters;
  if (storedSettings.languageFilters && typeof storedSettings.languageFilters === 'object') {
    for (const [lang, filters] of Object.entries(storedSettings.languageFilters)) {
      mergedLanguageFilters[lang] = { ...(mergedLanguageFilters[lang] ?? {}), ...filters };
    }
  }
  state.settings = { ...DEFAULT_SETTINGS, ...storedSettings, languageFilters: mergedLanguageFilters };
}
setSettings(state.settings);
applySettingsToControls();
syncModalFromHash();
setStatus('Upload a zip to begin.');
setLandingStatus('Select a zip or try the demo.');
showLanding();
