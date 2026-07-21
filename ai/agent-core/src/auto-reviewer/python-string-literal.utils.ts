import { readQuotedLiteral } from './interpreter-script-token.utils';

type PythonStringPrefix = {
  length: number;
  formatted: boolean;
  bytes: boolean;
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

  return { value, endIndex };
}

function readPythonStringChunk(source: string, startIndex: number): PythonStringChunk | null {
  const prefix = readStaticPythonStringPrefix(source, startIndex);
  if (!prefix) return null;

  const literal = readQuotedLiteral(source, startIndex + prefix.length);
  if (!literal || (prefix.formatted && /[{}]/.test(literal.value))) return null;
  return { value: literal.value, endIndex: literal.endIndex, bytes: prefix.bytes };
}

function readStaticPythonStringPrefix(source: string, startIndex: number): PythonStringPrefix | null {
  if (source[startIndex] === '"' || source[startIndex] === "'") {
    return { length: 0, formatted: false, bytes: false };
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
    return { length: prefix.length, formatted: false, bytes: normalized.includes('b') };
  }
  return STATIC_F_STRING_PREFIXES.has(normalized)
    ? { length: prefix.length, formatted: true, bytes: false }
    : null;
}
