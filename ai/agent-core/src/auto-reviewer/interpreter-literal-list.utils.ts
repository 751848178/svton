import { quotedStringEndIndex } from './interpreter-script-token.utils';
import {
  readStaticInterpreterString,
  type InterpreterStringConcatOperator,
  type InterpreterStringLiteralReader,
} from './interpreter-static-string.utils';

type InterpreterLiteralListOptions = {
  literalReaders?: InterpreterStringLiteralReader[];
  methodNames?: string[];
  prependMethodNames?: string[];
};

type InterpreterLiteralListValue = {
  value: string;
  endIndex: number;
};

export function readLiteralArray(source: string, startIndex: number): string[] | null {
  return readDelimitedLiteralList(source, startIndex, '[', ']');
}

export function readLiteralTuple(source: string, startIndex: number): string[] | null {
  return readDelimitedLiteralList(source, startIndex, '(', ')');
}

export function readLiteralList(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[] = [],
  options: InterpreterLiteralListOptions = {},
): string[] | null {
  const values: string[] = [];
  let cursor = startIndex;

  while (cursor < source.length) {
    const literal = readLiteralListValue(source, cursor, operators, options);
    if (!literal) break;
    values.push(literal.value);
    const comma = nextCommaIndex(source, literal.endIndex + 1);
    if (comma < 0) break;
    cursor = comma + 1;
  }

  return values.length > 0 ? values : null;
}

function readLiteralListValue(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  options: InterpreterLiteralListOptions,
): InterpreterLiteralListValue | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '(') return readParenthesizedLiteralListValue(source, cursor, operators, options);

  return readStaticInterpreterString(source, cursor, operators, {
    literalReaders: options.literalReaders,
    methodNames: options.methodNames,
    prependMethodNames: options.prependMethodNames,
  });
}

function readParenthesizedLiteralListValue(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  options: InterpreterLiteralListOptions,
): InterpreterLiteralListValue | null {
  const inner = readLiteralListValue(source, startIndex + 1, operators, options);
  if (!inner) return null;

  const closeIndex = skipWhitespace(source, inner.endIndex + 1);
  if (source[closeIndex] !== ')' || !literalListBoundaryValid(source, closeIndex)) return null;

  return { value: inner.value, endIndex: closeIndex };
}

function readDelimitedLiteralList(source: string, startIndex: number, opener: string, closer: string): string[] | null {
  const cursor = skipWhitespace(source, startIndex);
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
  const cursor = skipWhitespace(source, closeIndex + 1);
  return source[cursor] === ')' || source[cursor] === ',';
}

function skipWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
