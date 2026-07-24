import { escapedFunctionPattern } from './interpreter-script-token.utils';
import {
  readStaticInterpreterString,
  type InterpreterStringConcatOperator,
  type InterpreterStringLiteralReader,
} from './interpreter-static-string.utils';
import {
  readPerlQuoteLikeStringLiteral,
  readRubyQuoteLikeStringLiteral,
} from './interpreter-quote-like-string.utils';
import {
  readPerlQwWordListLiteral,
  readRubyPercentWordListLiteral,
} from './interpreter-word-list-literal.utils';
import { skipRubyLeadingEnvHash } from './ruby-env-prefix.utils';

export function rubyWordListDirectCommandTokenGroups(code: string, functionNames: string[]): string[][] {
  const options = {
    operators: ['+'] as InterpreterStringConcatOperator[],
    literalReaders: [readRubyQuoteLikeStringLiteral],
    wordListReader: readRubySplatWordList,
  };

  return functionNames.flatMap((functionName) =>
    callStartIndexes(code, functionName).flatMap((callStart) => {
      const argumentStart = skipRubyLeadingEnvHash(code, callStart);
      const values = readMixedDirectArguments(code, argumentStart, options);
      return values && values.length > 1 ? [values] : [];
    }),
  );
}

export function perlWordListDirectCommandTokenGroups(code: string, functionNames: string[]): string[][] {
  const options = {
    operators: ['.'] as InterpreterStringConcatOperator[],
    literalReaders: [readPerlQuoteLikeStringLiteral],
    wordListReader: readPerlQwWordList,
  };

  return functionNames.flatMap((functionName) =>
    callStartIndexes(code, functionName).flatMap((callStart) => {
      const values = readMixedDirectArguments(code, callStart, options);
      return values && values.length > 1 ? [values] : [];
    }),
  );
}

type DirectArgumentReader = (source: string, startIndex: number) => { values: string[]; endIndex: number } | null;

type MixedDirectArgumentOptions = {
  operators: InterpreterStringConcatOperator[];
  literalReaders: InterpreterStringLiteralReader[];
  wordListReader: DirectArgumentReader;
};

function readMixedDirectArguments(
  source: string,
  startIndex: number,
  options: MixedDirectArgumentOptions,
): string[] | null {
  const values: string[] = [];
  let cursor = startIndex;
  let sawWordList = false;

  while (cursor < source.length) {
    const argument = readDirectArgument(source, cursor, options);
    if (!argument) break;

    values.push(...argument.values);
    sawWordList ||= argument.kind === 'word-list';

    cursor = skipWhitespace(source, argument.endIndex + 1);
    if (source[cursor] !== ',') break;
    cursor += 1;
  }

  return sawWordList && values.length > 0 ? values : null;
}

function readDirectArgument(
  source: string,
  startIndex: number,
  options: MixedDirectArgumentOptions,
): { values: string[]; endIndex: number; kind: 'literal' | 'word-list' } | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '(') return readParenthesizedDirectArgument(source, cursor, options);

  const wordList = options.wordListReader(source, cursor);
  if (wordList) return { ...wordList, kind: 'word-list' };

  const literal = readStaticInterpreterString(source, cursor, options.operators, {
    literalReaders: options.literalReaders,
  });
  return literal ? { values: [literal.value], endIndex: literal.endIndex, kind: 'literal' } : null;
}

function readParenthesizedDirectArgument(
  source: string,
  startIndex: number,
  options: MixedDirectArgumentOptions,
): { values: string[]; endIndex: number; kind: 'literal' | 'word-list' } | null {
  const inner = readDirectArgument(source, startIndex + 1, options);
  if (!inner) return null;

  const closeIndex = skipWhitespace(source, inner.endIndex + 1);
  return source[closeIndex] === ')' && directArgumentBoundaryValid(source, closeIndex)
    ? { values: inner.values, endIndex: closeIndex, kind: inner.kind }
    : null;
}

function directArgumentBoundaryValid(source: string, endIndex: number): boolean {
  const cursor = skipWhitespace(source, endIndex + 1);
  return source[cursor] === ')' || source[cursor] === ',';
}

function readRubySplatWordList(source: string, startIndex: number): { values: string[]; endIndex: number } | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] !== '*') return null;

  const literal = readRubyPercentWordListLiteral(source, cursor + 1);
  return literal && wordListBoundaryValid(source, literal.endIndex) ? literal : null;
}

function readPerlQwWordList(source: string, startIndex: number): { values: string[]; endIndex: number } | null {
  const literal = readPerlQwWordListLiteral(source, startIndex);
  return literal && wordListBoundaryValid(source, literal.endIndex) ? literal : null;
}

function callStartIndexes(code: string, functionName: string): number[] {
  return [...code.matchAll(new RegExp(`(?:^|[^A-Za-z0-9_$])${escapedFunctionPattern(functionName)}\\s*\\(`, 'g'))]
    .map((match) => Number(match.index) + match[0].length);
}

function wordListBoundaryValid(source: string, endIndex: number): boolean {
  const cursor = skipWhitespace(source, endIndex + 1);
  return source[cursor] === ')' || source[cursor] === ',';
}

function skipWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
