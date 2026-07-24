export type InterpreterStringLiteral = {
  value: string;
  endIndex: number;
};

const QUOTE_DELIMITERS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '<': '>',
};

export function readRubyQuoteLikeStringLiteral(
  source: string,
  startIndex: number,
): InterpreterStringLiteral | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] !== '%' || (source[cursor + 1] !== 'q' && source[cursor + 1] !== 'Q')) return null;
  return readQuoteLikeBody(source, cursor + 2, 'ruby');
}

export function readPerlQuoteLikeStringLiteral(
  source: string,
  startIndex: number,
): InterpreterStringLiteral | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] !== 'q') return null;

  if (source[cursor + 1] === 'q') return readQuoteLikeBody(source, cursor + 2, 'perl');
  if (/[A-Za-z0-9_]/.test(source[cursor + 1] ?? '')) return null;
  return readQuoteLikeBody(source, cursor + 1, null);
}

export function readRubyCommandOutputLiteral(
  source: string,
  startIndex: number,
): InterpreterStringLiteral | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '`') return readBacktickBody(source, cursor, 'ruby');
  if (source[cursor] === '%' && source[cursor + 1] === 'x') return readQuoteLikeBody(source, cursor + 2, 'ruby');
  return null;
}

export function readPerlCommandOutputLiteral(
  source: string,
  startIndex: number,
): InterpreterStringLiteral | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '`') return readBacktickBody(source, cursor, 'perl');
  if (source[cursor] === 'q' && source[cursor + 1] === 'x') return readQuoteLikeBody(source, cursor + 2, 'perl');
  return null;
}

function readQuoteLikeBody(
  source: string,
  delimiterIndex: number,
  interpolation: 'ruby' | 'perl' | null,
): InterpreterStringLiteral | null {
  const opener = source[delimiterIndex] ?? '';
  const closer = QUOTE_DELIMITERS[opener] ?? opener;
  if (!opener || /\s/.test(opener)) return null;

  let value = '';
  let depth = QUOTE_DELIMITERS[opener] ? 1 : 0;
  for (let index = delimiterIndex + 1; index < source.length; index += 1) {
    const char = source[index] ?? '';
    if (interpolation === 'ruby' && char === '\\' && source[index + 1] === '\r' && source[index + 2] === '\n') {
      index += 2;
      continue;
    }
    if (interpolation === 'ruby' && char === '\\' && source[index + 1] === '\n') {
      index += 1;
      continue;
    }
    if (char === '\\' && source[index + 1]) {
      value += source[index + 1];
      index += 1;
      continue;
    }

    if (QUOTE_DELIMITERS[opener] && char === opener) {
      depth += 1;
      value += char;
      continue;
    }
    if (char === closer && (!QUOTE_DELIMITERS[opener] || depth === 1)) {
      return interpolation && hasInterpolation(value, interpolation)
        ? null
        : { value, endIndex: index };
    }
    if (char === closer) depth -= 1;
    value += char;
  }

  return null;
}

function readBacktickBody(
  source: string,
  startIndex: number,
  interpolation: 'ruby' | 'perl',
): InterpreterStringLiteral | null {
  let value = '';
  for (let index = startIndex + 1; index < source.length; index += 1) {
    const char = source[index] ?? '';
    if (char === '\\' && source[index + 1]) {
      value += source[index + 1];
      index += 1;
      continue;
    }

    if (char === '`') {
      return hasInterpolation(value, interpolation) ? null : { value, endIndex: index };
    }
    value += char;
  }

  return null;
}

function hasInterpolation(value: string, language: 'ruby' | 'perl'): boolean {
  if (language === 'ruby') return value.includes('#{') || value.includes('#$') || value.includes('#@');
  return /[$@]/.test(value);
}

function skipWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
