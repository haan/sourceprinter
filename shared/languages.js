const EXTENSION_LANGUAGE_MAP = new Map([
  // Java
  ['.java', 'java'],
  // Python
  ['.py', 'python'],
  ['.pyw', 'python'],
  // JavaScript
  ['.js', 'javascript'],
  ['.mjs', 'javascript'],
  ['.cjs', 'javascript'],
  ['.jsx', 'javascript'],
  // TypeScript
  ['.ts', 'typescript'],
  ['.tsx', 'typescript'],
  ['.mts', 'typescript'],
  ['.cts', 'typescript'],
  // C
  ['.c', 'c'],
  ['.h', 'c'],
  // C++
  ['.cpp', 'cpp'],
  ['.cc', 'cpp'],
  ['.cxx', 'cpp'],
  ['.hpp', 'cpp'],
  ['.hxx', 'cpp'],
  // C#
  ['.cs', 'csharp'],
  // Go
  ['.go', 'go'],
  // Rust
  ['.rs', 'rust'],
  // Ruby
  ['.rb', 'ruby'],
  ['.rake', 'ruby'],
  // PHP
  ['.php', 'php'],
  // Swift
  ['.swift', 'swift'],
  // Kotlin
  ['.kt', 'kotlin'],
  ['.kts', 'kotlin'],
  // Scala
  ['.scala', 'scala'],
  ['.sc', 'scala'],
  // R
  ['.r', 'r'],
  // MATLAB (also matches Objective-C .m, but student projects are more likely MATLAB)
  ['.m', 'matlab'],
  // Shell
  ['.sh', 'bash'],
  ['.bash', 'bash'],
  ['.zsh', 'bash'],
  ['.fish', 'bash'],
  ['.ksh', 'bash'],
  // SQL
  ['.sql', 'sql'],
  // // HTML / XML
  // ['.html', 'xml'],
  // ['.htm', 'xml'],
  // ['.xml', 'xml'],
  // ['.xsl', 'xml'],
  // ['.xslt', 'xml'],
  // // CSS
  // ['.css', 'css'],
  // ['.scss', 'scss'],
  // ['.sass', 'scss'],
  // ['.less', 'css'],
  // // Data / config
  // ['.json', 'json'],
  // ['.yaml', 'yaml'],
  // ['.yml', 'yaml'],
  // ['.toml', 'ini'],
  // ['.ini', 'ini'],
  // ['.cfg', 'ini'],
  // Markdown
  ['.md', 'markdown'],
  ['.markdown', 'markdown'],
  // Perl
  ['.pl', 'perl'],
  ['.pm', 'perl'],
  // Lua
  ['.lua', 'lua'],
  // Dart
  ['.dart', 'dart'],
  // Haskell
  ['.hs', 'haskell'],
  ['.lhs', 'haskell'],
  // Elixir
  ['.ex', 'elixir'],
  ['.exs', 'elixir'],
  // Erlang
  ['.erl', 'erlang'],
  ['.hrl', 'erlang'],
  // Clojure
  ['.clj', 'clojure'],
  ['.cljs', 'clojure'],
  ['.cljc', 'clojure'],
  // Fortran
  ['.f', 'fortran'],
  ['.f90', 'fortran'],
  ['.f95', 'fortran'],
  ['.for', 'fortran'],
  // Pascal / Delphi
  ['.pas', 'delphi'],
  ['.pp', 'delphi'],
  // Assembly
  ['.asm', 'x86asm'],
  ['.s', 'x86asm'],
  // PowerShell
  ['.ps1', 'powershell'],
  ['.psm1', 'powershell'],
  ['.psd1', 'powershell'],
  // Visual Basic
  ['.vb', 'vbscript'],
  ['.vbs', 'vbscript'],
  // // Groovy / Gradle
  // ['.groovy', 'groovy'],
  // ['.gradle', 'groovy'],
]);

export const HLJS_LANGUAGE_IDS = [...new Set(EXTENSION_LANGUAGE_MAP.values())];

export function getLanguageForExtension(filePath) {
  const dot = filePath.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = filePath.slice(dot).toLowerCase();
  return EXTENSION_LANGUAGE_MAP.get(ext) ?? null;
}

export function isSourceFile(filePath) {
  return getLanguageForExtension(filePath) !== null;
}
