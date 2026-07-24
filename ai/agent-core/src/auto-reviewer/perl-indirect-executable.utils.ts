import { escapedFunctionPattern } from './interpreter-script-token.utils';
import {
  readStaticInterpreterString,
  type InterpreterStringLiteralReader,
} from './interpreter-static-string.utils';
import { readPerlQwWordListLiteral } from './interpreter-word-list-literal.utils';

export function perlIndirectExecutableArguments(
  code: string,
  functionNames: string[],
  literalReaders: InterpreterStringLiteralReader[] = [],
): string[][] {
  return functionNames
    .flatMap((functionName) => callStartIndexes(code, functionName))
    .map((callStart) => perlIndirectCommandTokens(code, callStart, literalReaders))
    .filter((tokens) => tokens.length > 1);
}

function perlIndirectCommandTokens(
  code: string,
  callStart: number,
  literalReaders: InterpreterStringLiteralReader[],
): string[] {
  const executable = readIndirectExecutable(code, callStart, literalReaders);
  if (!executable) return [];

  const args = readIndirectArgumentList(code, executable.endIndex + 1, literalReaders) ?? [];
  return args.length > 1 ? [executable.value, ...args.slice(1)] : [];
}

function callStartIndexes(code: string, functionName: string): number[] {
  return [...code.matchAll(new RegExp(`(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\{`, 'g'))]
    .map((match) => Number(match.index) + match[0].length);
}

function readIndirectExecutable(
  source: string,
  startIndex: number,
  literalReaders: InterpreterStringLiteralReader[],
): { value: string; endIndex: number } | null {
  const executable = readPerlIndirectExecutableExpression(source, startIndex, literalReaders);
  if (!executable) return null;

  let cursor = executable.endIndex + 1;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return source[cursor] === '}' ? { value: executable.value, endIndex: cursor } : null;
}

function readPerlIndirectExecutableExpression(
  source: string,
  startIndex: number,
  literalReaders: InterpreterStringLiteralReader[],
): { value: string; endIndex: number } | null {
  const cursor = skipWhitespace(source, startIndex);

  if (source[cursor] !== '(') return readIndirectExecutableValue(source, cursor, literalReaders);

  const executable = readPerlIndirectExecutableExpression(source, cursor + 1, literalReaders);
  if (!executable) return null;

  const closeIndex = skipWhitespace(source, executable.endIndex + 1);
  return source[closeIndex] === ')' ? { value: executable.value, endIndex: closeIndex } : null;
}

function readIndirectExecutableValue(
  source: string,
  startIndex: number,
  literalReaders: InterpreterStringLiteralReader[],
): { value: string; endIndex: number } | null {
  return readStaticInterpreterString(source, startIndex, ['.'], { literalReaders }) ??
    readSingleWordListExecutable(source, startIndex);
}

function readSingleWordListExecutable(source: string, startIndex: number): { value: string; endIndex: number } | null {
  const literal = readPerlQwWordListLiteral(source, startIndex);
  return literal?.values.length === 1 ? { value: literal.values[0], endIndex: literal.endIndex } : null;
}

function readIndirectArgumentList(
  source: string,
  startIndex: number,
  literalReaders: InterpreterStringLiteralReader[],
): string[] | null {
  const values: string[] = [];
  let cursor = startIndex;

  while (cursor < source.length) {
    const argument = readIndirectArgument(source, cursor, literalReaders);
    if (!argument) break;

    values.push(...argument.values);
    cursor = skipWhitespace(source, argument.endIndex + 1);
    if (source[cursor] !== ',') break;
    cursor += 1;
  }

  return values.length > 0 ? values : null;
}

function readIndirectArgument(
  source: string,
  startIndex: number,
  literalReaders: InterpreterStringLiteralReader[],
): { values: string[]; endIndex: number } | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '(') return readParenthesizedIndirectArgument(source, cursor, literalReaders);

  const wordList = readPerlQwWordListLiteral(source, cursor);
  if (wordList) return wordList;

  const literal = readStaticInterpreterString(source, cursor, ['.'], { literalReaders });
  return literal ? { values: [literal.value], endIndex: literal.endIndex } : null;
}

function readParenthesizedIndirectArgument(
  source: string,
  startIndex: number,
  literalReaders: InterpreterStringLiteralReader[],
): { values: string[]; endIndex: number } | null {
  const inner = readIndirectArgument(source, startIndex + 1, literalReaders);
  if (!inner) return null;

  const closeIndex = skipWhitespace(source, inner.endIndex + 1);
  if (source[closeIndex] !== ')' || !indirectArgumentBoundary(source, closeIndex)) return null;

  return { values: inner.values, endIndex: closeIndex };
}

function indirectArgumentBoundary(source: string, endIndex: number): boolean {
  const cursor = skipWhitespace(source, endIndex + 1);
  return cursor >= source.length || source[cursor] === ',' || source[cursor] === ')' || source[cursor] === ';';
}

function skipWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
