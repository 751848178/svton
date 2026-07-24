import {
  readStaticInterpreterString,
  type InterpreterStringConcatOperator,
  type InterpreterStringLiteralReader,
} from './interpreter-static-string.utils';
import { readPerlQwWordListLiteral } from './interpreter-word-list-literal.utils';
import type { RubyPerlStaticStringAssignment } from './ruby-perl-static-reference.utils';

export const PERL_STATIC_NAME_PATTERN = '\\$[A-Za-z_][A-Za-z0-9_]*';
export const PERL_STATIC_DECLARATION_PATTERN = '(?:(?:my|our|local)\\s+)?';
export const PERL_STATIC_SCALAR_DECLARATION_PATTERN = '(?:(?:my|our|local|state)\\s+)?';
export const PERL_STATIC_TARGET_PATTERN = `(?:${PERL_STATIC_SCALAR_DECLARATION_PATTERN}(${PERL_STATIC_NAME_PATTERN})|${PERL_STATIC_DECLARATION_PATTERN}\\(\\s*(${PERL_STATIC_NAME_PATTERN})\\s*\\))`;

type PerlStaticListValues = {
  values: string[];
  endIndex: number;
  acceptsTrailingComma: boolean;
};

type PerlStaticListTarget = string | null;

export function perlStaticListAssignments(
  code: string,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
): RubyPerlStaticStringAssignment[] {
  const assignments: RubyPerlStaticStringAssignment[] = [];
  const pattern = new RegExp(`(?:^|[;\\n])\\s*${PERL_STATIC_DECLARATION_PATTERN}\\(([^)]*,[^)]*)\\)\\s*=\\s*`, 'g');

  for (const match of code.matchAll(pattern)) {
    const names = perlStaticListAssignmentNames(match[1]);
    if (names.length < 2) continue;

    const valueStart = Number(match.index) + match[0].length;
    const values = readPerlStaticListValues(code, valueStart, operators, literalReaders);
    const endIndex = values?.endIndex ?? valueStart;
    const isBoundary = values && perlListAssignmentValueBoundary(code, values);

    names.forEach((assignmentName, index) => {
      if (!assignmentName) return;
      assignments.push({
        name: assignmentName,
        value: isBoundary ? values.values[index] ?? null : null,
        endIndex,
      });
    });
  }

  return assignments;
}

function perlStaticListAssignmentNames(source: string): PerlStaticListTarget[] {
  const names = source.split(',').map((part) => part.trim());
  const targets = names.map((name): PerlStaticListTarget | undefined => {
    if (new RegExp(`^${PERL_STATIC_NAME_PATTERN}$`).test(name)) return name;
    return name === 'undef' ? null : undefined;
  });
  return targets.every((target) => target !== undefined) ? targets as PerlStaticListTarget[] : [];
}

function readPerlStaticListValues(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
): PerlStaticListValues | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '(') return readParenthesizedPerlStaticListValues(source, cursor, operators, literalReaders);

  const wordList = readPerlQwWordListLiteral(source, cursor);
  if (wordList) return { values: wordList.values, endIndex: wordList.endIndex, acceptsTrailingComma: false };

  const first = readStaticInterpreterString(source, cursor, operators, { literalReaders });
  if (!first) return null;

  const boundary = skipWhitespace(source, first.endIndex + 1);
  return source[boundary] === ',' ? { values: [first.value], endIndex: first.endIndex, acceptsTrailingComma: true } : null;
}

function readParenthesizedPerlStaticListValues(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
): PerlStaticListValues | null {
  let cursor = startIndex + 1;
  const values: string[] = [];

  while (cursor < source.length) {
    const value = readParenthesizedPerlStaticListValue(source, cursor, operators, literalReaders);
    if (!value) return null;

    values.push(...value.values);
    cursor = skipWhitespace(source, value.endIndex + 1);
    if (source[cursor] === ',') {
      cursor += 1;
      continue;
    }
    return source[cursor] === ')' ? { values, endIndex: cursor, acceptsTrailingComma: false } : null;
  }
  return null;
}

function readParenthesizedPerlStaticListValue(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
): { values: string[]; endIndex: number } | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '(') {
    const values = readParenthesizedPerlStaticListValues(source, cursor, operators, literalReaders);
    return values ? { values: values.values, endIndex: values.endIndex } : null;
  }

  const wordList = readPerlQwWordListLiteral(source, cursor);
  if (wordList) return { values: wordList.values, endIndex: wordList.endIndex };

  const value = readStaticInterpreterString(source, cursor, operators, { literalReaders });
  return value ? { values: [value.value], endIndex: value.endIndex } : null;
}

function perlListAssignmentValueBoundary(source: string, values: PerlStaticListValues): boolean {
  const cursor = skipWhitespace(source, values.endIndex + 1);
  return cursor >= source.length ||
    source[cursor] === ';' ||
    source[cursor] === '\n' ||
    (values.acceptsTrailingComma && source[cursor] === ',');
}

function skipWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
