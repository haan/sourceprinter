const LANGUAGE_LABELS = {
  java: 'Java',
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  cpp: 'C++',
  c: 'C',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kotlin: 'Kotlin',
  scala: 'Scala',
};

export const LANGUAGE_FILTERS = {
  java: [
    { id: 'removeJavadoc', label: 'Remove Javadoc', default: false },
    { id: 'hideInitComponents', label: 'Hide initComponents()', default: false },
    { id: 'hideMain', label: 'Hide main()', default: false },
  ],
  // Example of how to add Python filters in the future:
  // python: [
  //   { id: 'removeDocstrings', label: 'Remove Docstrings', default: false },
  // ],
};

export function getFiltersForLanguage(languageId) {
  return LANGUAGE_FILTERS[languageId] ?? [];
}

export function getFiltersForLanguages(languageIds) {
  return languageIds
    .filter((id) => (LANGUAGE_FILTERS[id]?.length ?? 0) > 0)
    .map((id) => ({
      language: id,
      languageLabel: LANGUAGE_LABELS[id] ?? id,
      filters: LANGUAGE_FILTERS[id],
    }));
}
