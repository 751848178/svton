export function pythonKeywordValueIndex(
  source: string,
  startIndex: number,
  endIndex: number,
  keyword: string,
): number {
  let quote: '"' | "'" | null = null;

  for (let index = startIndex; index < endIndex; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (!source.startsWith(keyword, index) || !pythonNameBoundary(source, index - 1)) continue;
    let cursor = index + keyword.length;
    if (!pythonNameBoundary(source, cursor)) continue;
    while (/\s/.test(source[cursor] ?? '')) cursor += 1;
    if (source[cursor] === '=') return cursor + 1;
  }

  return -1;
}

export function pythonPositionalArgumentValueIndex(
  source: string,
  startIndex: number,
  endIndex: number,
  position: number,
): number {
  let argumentStart = startIndex;
  let positionIndex = 0;
  let quote: '"' | "'" | null = null;
  let depth = 0;

  for (let index = startIndex; index <= endIndex; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(' || char === '[' || char === '{') depth += 1;
    if (char === ')' || char === ']' || char === '}') depth -= 1;
    if (depth !== 0 && index < endIndex) continue;
    if (char !== ',' && index < endIndex) continue;

    const valueIndex = pythonPositionalValueIndex(source, argumentStart, index);
    if (valueIndex < 0) return -1;
    if (positionIndex === position) return valueIndex;
    positionIndex += 1;
    argumentStart = index + 1;
  }

  return -1;
}

export function pythonCallEndIndex(source: string, startIndex: number): number {
  let depth = 1;
  let quote: '"' | "'" | null = null;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth === 0) return index;
  }

  return source.length;
}

function pythonNameBoundary(source: string, index: number): boolean {
  return !/[A-Za-z0-9_]/.test(source[index] ?? '');
}

function pythonPositionalValueIndex(source: string, startIndex: number, endIndex: number): number {
  let cursor = startIndex;
  while (cursor < endIndex && /\s/.test(source[cursor] ?? '')) cursor += 1;
  if (cursor >= endIndex || source[cursor] === '*') return -1;

  const argument = source.slice(cursor, endIndex);
  return /^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(argument) ? -1 : cursor;
}
