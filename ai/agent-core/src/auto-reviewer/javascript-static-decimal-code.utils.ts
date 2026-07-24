export function readDecimalInteger(source: string, startIndex: number): { value: number; endIndex: number } | null {
  const match = source.slice(startIndex).match(/^(?:0|[1-9]\d*)/);
  if (!match) return null;

  const endIndex = startIndex + match[0].length - 1;
  if (identifierChar(source[endIndex + 1]) || source[endIndex + 1] === '.') return null;

  const value = Number(match[0]);
  return Number.isSafeInteger(value) ? { value, endIndex } : null;
}

export function readDecimalIntegerArray(
  source: string,
  startIndex: number,
): { values: number[]; endIndex: number } | null {
  let cursor = skipWhitespace(source, startIndex);
  if (source[cursor] !== '[') return null;
  cursor += 1;

  const values: number[] = [];
  while (cursor < source.length) {
    cursor = skipWhitespace(source, cursor);
    if (source[cursor] === ']') return values.length > 0 ? { values, endIndex: cursor } : null;

    const value = readDecimalInteger(source, cursor);
    if (!value) return null;
    values.push(value.value);
    cursor = skipWhitespace(source, value.endIndex + 1);

    if (source[cursor] === ',') {
      cursor += 1;
      continue;
    }
    if (source[cursor] === ']') return { values, endIndex: cursor };
    return null;
  }

  return null;
}

export function identifierChar(char: string | undefined): boolean {
  return /[A-Za-z0-9_$]/.test(char ?? '');
}

export function skipWhitespace(source: string, index: number): number {
  let cursor = index;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
