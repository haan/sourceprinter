function stripCommentsPreserveLines(text, mode) {
  let output = '';
  let index = 0;
  let state = 'code';

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];

    if (state === 'code') {
      if (char === '"') {
        state = 'string';
        output += char;
        index += 1;
        continue;
      }
      if (char === "'") {
        state = 'charlit';
        output += char;
        index += 1;
        continue;
      }
      if (char === '/' && next === '/') {
        if (mode === 'all') {
          state = 'line';
          index += 2;
          continue;
        }
      }
      if (char === '/' && next === '*') {
        const isJavadoc = text[index + 2] === '*';
        const shouldRemove = mode === 'all' || (mode === 'javadoc' && isJavadoc);
        if (shouldRemove) {
          state = 'block';
          index += 2;
          continue;
        }
        state = 'keepblock';
        output += '/*';
        index += 2;
        continue;
      }

      output += char;
      index += 1;
      continue;
    }

    if (state === 'string') {
      output += char;
      if (char === '\\' && next !== undefined) {
        output += next;
        index += 2;
        continue;
      }
      if (char === '"' || char === '\n') {
        state = 'code';
      }
      index += 1;
      continue;
    }

    if (state === 'charlit') {
      output += char;
      if (char === '\\' && next !== undefined) {
        output += next;
        index += 2;
        continue;
      }
      if (char === "'" || char === '\n') {
        state = 'code';
      }
      index += 1;
      continue;
    }

    if (state === 'line') {
      if (char === '\n') {
        output += '\n';
        state = 'code';
      }
      index += 1;
      continue;
    }

    if (state === 'block') {
      if (char === '\n') {
        output += '\n';
      }
      if (char === '*' && next === '/') {
        state = 'code';
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }

    if (state === 'keepblock') {
      output += char;
      if (char === '*' && next === '/') {
        output += '/';
        state = 'code';
        index += 2;
        continue;
      }
      index += 1;
    }
  }

  return output;
}

function replaceTabs(text, tabWidth = 4) {
  const spaces = ' '.repeat(tabWidth);
  return text.replace(/\t/g, spaces);
}

function hideMethodBodyLines(lines, signature, label) {
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const lineText = line.text;
    const signatureIndex = lineText.indexOf(signature);
    if (signatureIndex === -1) {
      index += 1;
      continue;
    }

    const indentMatch = lineText.match(/^\s*/);
    const indent = indentMatch ? indentMatch[0] : '';
    const signatureIndent = indent.length;

    let openLine = index;
    let openPos = lineText.indexOf('{', signatureIndex);
    while (openPos === -1 && openLine + 1 < lines.length) {
      const nextLine = lines[openLine + 1];
      const nextIndent = (nextLine.text.match(/^\s*/) || [''])[0].length;
      if (nextLine.text.trim() !== '' && nextIndent <= signatureIndent) {
        break;
      }
      openLine += 1;
      openPos = lines[openLine].text.indexOf('{');
    }
    if (openPos === -1) {
      index += 1;
      continue;
    }

    let depth = 0;
    let endLine = openLine;
    for (let lineIndex = openLine; lineIndex < lines.length; lineIndex += 1) {
      const text = lines[lineIndex].text;
      const start = lineIndex === openLine ? openPos : 0;
      for (let charIndex = start; charIndex < text.length; charIndex += 1) {
        const ch = text[charIndex];
        if (ch === '{') depth += 1;
        if (ch === '}') {
          depth -= 1;
          if (depth === 0) {
            endLine = lineIndex;
            lineIndex = lines.length;
            break;
          }
        }
      }
    }

    if (endLine === index) {
      const beforeBrace = lineText.slice(0, openPos + 1);
      line.text = `${beforeBrace} // ${label} hidden }`;
      line.removed = false;
      index += 1;
      continue;
    }

    if (openLine === index) {
      line.text = lineText.slice(0, openPos + 1);
      line.removed = false;
    } else {
      lines[openLine].text = `${indent}{`;
      lines[openLine].removed = false;
    }

    const commentLine = Math.min(openLine + 1, endLine);
    if (commentLine < endLine) {
      lines[commentLine].text = `${indent}  // ${label} hidden`;
      lines[commentLine].removed = false;
    } else {
      // Empty body: no room for a separate comment line — append inline to the opening brace
      const openLineRef = openLine === index ? line : lines[openLine];
      openLineRef.text += ` // ${label} hidden`;
    }

    for (let lineIndex = commentLine + 1; lineIndex < endLine; lineIndex += 1) {
      lines[lineIndex].text = '';
      lines[lineIndex].removed = true;
    }

    lines[endLine].text = `${indent}}`;
    lines[endLine].removed = false;
    index = endLine + 1;
  }

  return lines;
}

function collapseBlankLineObjects(lines) {
  const result = [];
  let previousBlank = false;

  for (const line of lines) {
    const isBlank = line.text.trim() === '';
    if (isBlank) {
      if (!previousBlank) {
        result.push(line);
        previousBlank = true;
      }
    } else {
      result.push(line);
      previousBlank = false;
    }
  }

  return result;
}

export function applyFilters(content, options = {}) {
  const { lines } = applyFiltersWithLineNumbers(content, options);
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  return lines.map((l) => l.text).join(newline);
}

export function applyFiltersWithLineNumbers(content, options = {}) {
  const langOpts = options.languageFilters?.[options.language] ?? {};
  const removeJavadoc = Boolean(options.removeJavadoc ?? langOpts.removeJavadoc);
  const removeComments = Boolean(options.removeComments);
  const collapseBlanks = Boolean(options.collapseBlankLines);
  const hideInitComponents = Boolean(options.hideInitComponents ?? langOpts.hideInitComponents);
  const hideMain = Boolean(options.hideMain ?? langOpts.hideMain);
  const tabsToSpaces = Boolean(options.tabsToSpaces);

  const originalLines = content.split(/\r?\n/);
  let working = content;
  if (removeComments) {
    working = stripCommentsPreserveLines(working, 'all');
  } else if (removeJavadoc) {
    working = stripCommentsPreserveLines(working, 'javadoc');
  }

  let lines = working.split(/\r?\n/).map((line, index) => ({
    number: index + 1,
    text: line,
    removed: false,
  }));
  const maxLineNumber = originalLines.length;

  if (removeComments || removeJavadoc) {
    lines.forEach((line, index) => {
      if (line.text === '' && (originalLines[index] || '').trim() !== '') {
        line.removed = true;
      }
    });
  }

  if (hideInitComponents) {
    lines = hideMethodBodyLines(lines, 'private void initComponents()', 'initComponents()');
  }

  if (hideMain) {
    lines = hideMethodBodyLines(lines, 'public static void main', 'main()');
  }

  if (tabsToSpaces) {
    lines = lines.map((line) => ({
      ...line,
      text: replaceTabs(line.text, 4),
    }));
  }

  let lineObjects = lines.filter((line) => !line.removed).map((line) => ({
    number: line.number,
    text: line.text,
  }));

  if (collapseBlanks) {
    lineObjects = collapseBlankLineObjects(lineObjects);
  }

  return { lines: lineObjects, maxLineNumber };
}
