import { callEndIndex, escapedFunctionPattern } from './interpreter-script-token.utils';
import {
  readStaticInterpreterString,
  type InterpreterStringConcatOperator,
  type InterpreterStringLiteralReader,
} from './interpreter-static-string.utils';
import { readRubyAssignedCommandArrayPair } from './ruby-command-array-assignment.utils';
import {
  readRubyCommandArrayPairExpression,
  readRubySplatWordList,
  skipRubyWhitespace,
} from './ruby-command-array-literal.utils';
import { skipRubyLeadingEnvHash } from './ruby-env-prefix.utils';

export function rubyCommandArrayPairArguments(
  code: string,
  functionNames: string[],
  operators: InterpreterStringConcatOperator[] = [],
  literalReaders: InterpreterStringLiteralReader[] = [],
): string[][] {
  return functionNames
    .flatMap((functionName) => callStartIndexes(code, functionName))
    .map((callStart) => rubyPairCommandTokens(code, callStart, operators, literalReaders))
    .filter((tokens) => tokens.length > 1);
}

function rubyPairCommandTokens(
  code: string,
  callStart: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
): string[] {
  const argumentStart = skipRubyLeadingEnvHash(code, callStart);
  const commandPair = readRubyCommandArrayPairExpression(code, argumentStart, operators, literalReaders)
    ?? readRubyAssignedCommandArrayPair(code, argumentStart, callStart, operators, literalReaders);
  if (!commandPair) return [];

  const args = readRubyPairArgumentList(
    code,
    nextArgumentCommaIndex(code, commandPair.endIndex + 1, callStart) + 1,
    operators,
    literalReaders,
  ) ?? [];
  return [commandPair.command, ...args];
}

function callStartIndexes(code: string, functionName: string): number[] {
  return [...code.matchAll(new RegExp(`(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\(`, 'g'))]
    .map((match) => Number(match.index) + match[0].length);
}

function nextArgumentCommaIndex(source: string, startIndex: number, callStart: number): number {
  const commaIndex = source.indexOf(',', startIndex);
  const endIndex = callEndIndex(source, callStart);
  return commaIndex >= 0 && commaIndex < endIndex ? commaIndex : -1;
}

function readRubyPairArgumentList(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
): string[] | null {
  const values: string[] = [];
  let cursor = startIndex;

  while (cursor < source.length) {
    const argument = readRubyPairArgument(source, cursor, operators, literalReaders);
    if (!argument) break;

    values.push(...argument.values);
    cursor = skipRubyWhitespace(source, argument.endIndex + 1);
    if (source[cursor] !== ',') break;
    cursor += 1;
  }

  return values.length > 0 ? values : null;
}

function readRubyPairArgument(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
): { values: string[]; endIndex: number } | null {
  const cursor = skipRubyWhitespace(source, startIndex);
  if (source[cursor] === '(') return readParenthesizedRubyPairArgument(source, cursor, operators, literalReaders);

  const wordList = readRubySplatWordList(source, startIndex, [')', ',']);
  if (wordList) return wordList;

  const literal = readStaticInterpreterString(source, startIndex, operators, { literalReaders });
  return literal ? { values: [literal.value], endIndex: literal.endIndex } : null;
}

function readParenthesizedRubyPairArgument(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
): { values: string[]; endIndex: number } | null {
  const inner = readRubyPairArgument(source, startIndex + 1, operators, literalReaders);
  if (!inner) return null;

  const closeIndex = skipRubyWhitespace(source, inner.endIndex + 1);
  if (source[closeIndex] !== ')' || !rubyPairArgumentBoundary(source, closeIndex)) return null;

  return { values: inner.values, endIndex: closeIndex };
}

function rubyPairArgumentBoundary(source: string, endIndex: number): boolean {
  const cursor = skipRubyWhitespace(source, endIndex + 1);
  return source[cursor] === ',' || source[cursor] === ')';
}
