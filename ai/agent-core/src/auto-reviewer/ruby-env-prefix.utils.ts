import { quotedStringEndIndex } from './interpreter-script-token.utils';

export function skipRubyLeadingEnvHash(source: string, startIndex: number): number {
  let cursor = skipWhitespace(source, startIndex);
  if (source[cursor] !== '{') return startIndex;

  const closeIndex = closingHashIndex(source, cursor);
  if (closeIndex < 0) return startIndex;

  cursor = skipWhitespace(source, closeIndex + 1);
  return source[cursor] === ',' ? cursor + 1 : startIndex;
}

function closingHashIndex(source: string, startIndex: number): number {
  let depth = 0;
  for (let index = startIndex; index < source.length; index += 1) {
    const quotedEnd = quotedStringEndIndex(source, index);
    if (quotedEnd !== null) {
      index = quotedEnd;
      continue;
    }

    const char = source[index];
    if (char === '{') depth += 1;
    if (char !== '}') continue;
    depth -= 1;
    if (depth === 0) return index;
  }

  return -1;
}

function skipWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
