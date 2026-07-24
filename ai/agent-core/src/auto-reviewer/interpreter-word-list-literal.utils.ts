type InterpreterWordList = {
  values: string[];
  endIndex: number;
};

const WORD_LIST_DELIMITERS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '<': '>',
};

export function readRubyPercentWordListLiteral(
  source: string,
  startIndex: number,
): InterpreterWordList | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] !== '%' || (source[cursor + 1] !== 'w' && source[cursor + 1] !== 'W')) return null;

  const literal = readWordListBody(source, cursor + 2);
  if (!literal) return null;
  if (source[cursor + 1] === 'W' && hasRubyInterpolation(literal.values.join(' '))) return null;
  return literal;
}

export function readPerlQwWordListLiteral(source: string, startIndex: number): InterpreterWordList | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source.slice(cursor, cursor + 2) !== 'qw') return null;
  if (/[A-Za-z0-9_]/.test(source[cursor + 2] ?? '')) return null;
  return readWordListBody(source, cursor + 2);
}

function readWordListBody(source: string, delimiterIndex: number): InterpreterWordList | null {
  const opener = source[delimiterIndex] ?? '';
  const closer = WORD_LIST_DELIMITERS[opener] ?? opener;
  if (!opener || /\s/.test(opener)) return null;

  const values: string[] = [];
  let current = '';
  let depth = WORD_LIST_DELIMITERS[opener] ? 1 : 0;
  for (let index = delimiterIndex + 1; index < source.length; index += 1) {
    const char = source[index] ?? '';
    if (char === '\\' && source[index + 1]) {
      current += source[index + 1];
      index += 1;
      continue;
    }

    if (WORD_LIST_DELIMITERS[opener] && char === opener) {
      depth += 1;
      current += char;
      continue;
    }
    if (char === closer && (!WORD_LIST_DELIMITERS[opener] || depth === 1)) {
      pushWordListValue(values, current);
      return values.length > 0 ? { values, endIndex: index } : null;
    }
    if (char === closer) depth -= 1;
    if (/\s/.test(char)) {
      pushWordListValue(values, current);
      current = '';
      continue;
    }
    current += char;
  }

  return null;
}

function pushWordListValue(values: string[], value: string): void {
  if (value.length > 0) values.push(value);
}

function hasRubyInterpolation(value: string): boolean {
  return value.includes('#{') || value.includes('#$') || value.includes('#@');
}

function skipWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
