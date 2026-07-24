import {
  readStaticInterpreterString,
  type InterpreterStringConcatOperator,
  type InterpreterStringLiteralReader,
} from './interpreter-static-string.utils';
import { readRubyPercentWordListLiteral } from './interpreter-word-list-literal.utils';

export type RubyCommandArrayPairExpression = {
  command: string;
  endIndex: number;
};

export function readRubyCommandArrayPairExpression(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
  wordListBoundaryChars: string[] = [',', ')'],
): RubyCommandArrayPairExpression | null {
  let cursor = skipRubyWhitespace(source, startIndex);
  if (source[cursor] === '(') {
    return readParenthesizedCommandArrayPair(source, cursor, operators, literalReaders);
  }

  const wordListPair = readCommandWordListArrayPair(source, cursor, wordListBoundaryChars);
  if (wordListPair) return wordListPair;
  if (source[cursor] !== '[') return null;

  const pair = readCommandArrayPairValues(source, cursor + 1, operators, literalReaders);
  if (!pair || pair.values.length !== 2) return null;

  cursor = skipRubyWhitespace(source, pair.endIndex + 1);
  if (source[cursor] === ',') cursor = skipRubyWhitespace(source, cursor + 1);
  return source[cursor] === ']' ? { command: pair.values[0], endIndex: cursor } : null;
}

export function readRubySplatWordList(
  source: string,
  startIndex: number,
  boundaryChars: string[],
): { values: string[]; endIndex: number } | null {
  const cursor = skipRubyWhitespace(source, startIndex);
  if (source[cursor] !== '*') return null;

  const literal = readRubyPercentWordListLiteral(source, cursor + 1);
  return literal && rubyArgumentBoundaryValid(source, literal.endIndex, boundaryChars) ? literal : null;
}

export function skipRubyWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}

function readCommandWordListArrayPair(
  source: string,
  startIndex: number,
  boundaryChars: string[],
): RubyCommandArrayPairExpression | null {
  const literal = readRubyPercentWordListLiteral(source, startIndex);
  if (!literal || literal.values.length !== 2) return null;

  return rubyArgumentBoundaryValid(source, literal.endIndex, boundaryChars)
    ? { command: literal.values[0], endIndex: literal.endIndex }
    : null;
}

function readParenthesizedCommandArrayPair(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
): RubyCommandArrayPairExpression | null {
  const pair = readRubyCommandArrayPairExpression(source, startIndex + 1, operators, literalReaders, [')']);
  if (!pair) return null;

  const cursor = skipRubyWhitespace(source, pair.endIndex + 1);
  return source[cursor] === ')' ? { command: pair.command, endIndex: cursor } : null;
}

function readCommandArrayPairValues(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
): { values: string[]; endIndex: number } | null {
  const values: string[] = [];
  let cursor = startIndex;
  let endIndex = -1;

  while (cursor < source.length) {
    const value = readCommandArrayPairValue(source, cursor, operators, literalReaders);
    if (!value) break;

    values.push(...value.values);
    endIndex = value.endIndex;
    cursor = skipRubyWhitespace(source, value.endIndex + 1);
    if (source[cursor] !== ',') break;
    cursor += 1;
  }

  return values.length > 0 ? { values, endIndex } : null;
}

function readCommandArrayPairValue(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
): { values: string[]; endIndex: number } | null {
  const wordList = readRubySplatWordList(source, startIndex, [',', ']']);
  if (wordList) return wordList;

  const literal = readStaticInterpreterString(source, startIndex, operators, { literalReaders });
  return literal ? { values: [literal.value], endIndex: literal.endIndex } : null;
}

function rubyArgumentBoundaryValid(source: string, endIndex: number, boundaryChars: string[]): boolean {
  const cursor = skipRubyWhitespace(source, endIndex + 1);
  return cursor >= source.length || boundaryChars.includes(source[cursor] ?? '');
}
