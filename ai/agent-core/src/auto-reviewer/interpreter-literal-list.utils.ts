import { quotedStringEndIndex, readQuotedLiteral } from './interpreter-script-token.utils';

export function readLiteralArray(source: string, startIndex: number): string[] | null {
  return readDelimitedLiteralList(source, startIndex, '[', ']');
}

export function readLiteralTuple(source: string, startIndex: number): string[] | null {
  return readDelimitedLiteralList(source, startIndex, '(', ')');
}

export function readLiteralList(source: string, startIndex: number): string[] | null {
  const values: string[] = [];
  let cursor = startIndex;

  while (cursor < source.length) {
    const literal = readQuotedLiteral(source, cursor);
    if (!literal) break;
    values.push(literal.value);
    const comma = nextCommaIndex(source, literal.endIndex + 1);
    if (comma < 0) break;
    cursor = comma + 1;
  }

  return values.length > 0 ? values : null;
}

function readDelimitedLiteralList(source: string, startIndex: number, opener: string, closer: string): string[] | null {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  if (source[cursor] !== opener) return null;

  const values = readLiteralList(source, cursor + 1);
  if (!values) return null;
  const closeIndex = closingDelimiterIndex(source, cursor + 1, closer);
  return closeIndex >= 0 && literalListBoundaryValid(source, closeIndex) ? values : null;
}

export function nextCommaIndex(source: string, startIndex: number): number {
  let depth = 0;
  for (let index = startIndex; index < source.length; index += 1) {
    const quotedEnd = quotedStringEndIndex(source, index);
    if (quotedEnd !== null) {
      index = quotedEnd;
      continue;
    }

    const char = source[index];
    if (char === ',' && depth === 0) return index;
    if (char === ')' && depth === 0) return -1;
    if (char === '(' || char === '[' || char === '{') depth += 1;
    if ((char === ')' || char === ']' || char === '}') && depth > 0) depth -= 1;
  }

  return -1;
}

function closingDelimiterIndex(source: string, startIndex: number, delimiter: string): number {
  const index = source.indexOf(delimiter, startIndex);
  return index >= 0 ? index : -1;
}

function literalListBoundaryValid(source: string, closeIndex: number): boolean {
  let cursor = closeIndex + 1;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return source[cursor] === ')' || source[cursor] === ',';
}
