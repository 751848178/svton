type PythonStringPrefix = {
  length: number;
  formatted: boolean;
  bytes: boolean;
  raw: boolean;
};

type PythonStringChunk = {
  value: string;
  endIndex: number;
  bytes: boolean;
};

const STATIC_PYTHON_STRING_PREFIXES = new Set(['', 'b', 'br', 'r', 'rb', 'u']);
const STATIC_F_STRING_PREFIXES = new Set(['f', 'fr', 'rf']);

export function readPythonStringLiteral(
  source: string,
  startIndex: number,
): { value: string; endIndex: number } | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;

  const firstSequence = readPythonStringSequence(source, cursor);
  if (!firstSequence) return null;

  let value = firstSequence.value;
  let endIndex = firstSequence.endIndex;

  while (endIndex + 1 < source.length) {
    cursor = endIndex + 1;
    while (/\s/.test(source[cursor] ?? '')) cursor += 1;
    if (source[cursor] !== '+') break;

    const nextSequence = readPythonStringSequence(source, cursor + 1);
    if (!nextSequence || nextSequence.bytes !== firstSequence.bytes) return null;

    value += nextSequence.value;
    endIndex = nextSequence.endIndex;
  }

  return { value, endIndex };
}

function readPythonStringSequence(source: string, startIndex: number): PythonStringChunk | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;

  const firstChunk = readPythonStringChunk(source, cursor);
  if (!firstChunk) return null;

  let value = firstChunk.value;
  let endIndex = firstChunk.endIndex;

  while (endIndex + 1 < source.length) {
    cursor = endIndex + 1;
    while (/\s/.test(source[cursor] ?? '')) cursor += 1;

    const nextChunk = readPythonStringChunk(source, cursor);
    if (!nextChunk) break;
    if (nextChunk.bytes !== firstChunk.bytes) return null;
    value += nextChunk.value;
    endIndex = nextChunk.endIndex;
  }

  return { value, endIndex, bytes: firstChunk.bytes };
}

function readPythonStringChunk(source: string, startIndex: number): PythonStringChunk | null {
  const prefix = readStaticPythonStringPrefix(source, startIndex);
  if (!prefix) return null;

  const literal = readPythonQuotedLiteral(source, startIndex + prefix.length, {
    raw: prefix.raw,
  });
  if (!literal || (prefix.formatted && /[{}]/.test(literal.value))) return null;
  return { value: literal.value, endIndex: literal.endIndex, bytes: prefix.bytes };
}

function readPythonQuotedLiteral(
  source: string,
  startIndex: number,
  options: { raw: boolean },
): { value: string; endIndex: number } | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  const quote = source[cursor];
  if (quote !== '"' && quote !== "'") return null;

  const delimiterLength = source.startsWith(quote.repeat(3), cursor) ? 3 : 1;
  let value = '';
  for (let index = cursor + delimiterLength; index < source.length; index += 1) {
    const char = source[index];
    if (
      delimiterLength === 3
      && source.startsWith(quote.repeat(3), index)
      && source[index - 1] !== '\\'
    ) {
      return { value, endIndex: index + 2 };
    }
    if (delimiterLength === 1 && char === quote && source[index - 1] !== '\\') {
      return { value, endIndex: index };
    }
    if (!options.raw && char === '\\' && source[index + 1] === '\r' && source[index + 2] === '\n') {
      index += 2;
      continue;
    }
    if (!options.raw && char === '\\' && source[index + 1] === '\n') {
      index += 1;
      continue;
    }
    if (char === '\\' && source[index + 1]) {
      value += options.raw ? char + source[index + 1] : source[index + 1];
      index += 1;
      continue;
    }
    value += char;
  }

  return null;
}

function readStaticPythonStringPrefix(source: string, startIndex: number): PythonStringPrefix | null {
  if (source[startIndex] === '"' || source[startIndex] === "'") {
    return { length: 0, formatted: false, bytes: false, raw: false };
  }

  let prefix = '';
  while (/[A-Za-z]/.test(source[startIndex + prefix.length] ?? '') && prefix.length < 2) {
    prefix += source[startIndex + prefix.length];
  }

  if (source[startIndex + prefix.length] !== '"' && source[startIndex + prefix.length] !== "'") {
    return null;
  }

  const normalized = prefix.toLowerCase();
  if (STATIC_PYTHON_STRING_PREFIXES.has(normalized)) {
    return {
      length: prefix.length,
      formatted: false,
      bytes: normalized.includes('b'),
      raw: normalized.includes('r'),
    };
  }
  return STATIC_F_STRING_PREFIXES.has(normalized)
    ? { length: prefix.length, formatted: true, bytes: false, raw: normalized.includes('r') }
    : null;
}
