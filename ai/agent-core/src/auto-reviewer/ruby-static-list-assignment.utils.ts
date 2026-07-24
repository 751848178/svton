import {
  readStaticInterpreterString,
  type InterpreterStringConcatOperator,
  type InterpreterStringLiteralReader,
} from './interpreter-static-string.utils';
import { readRubyPercentWordListLiteral } from './interpreter-word-list-literal.utils';
import type { RubyPerlStaticStringAssignment } from './ruby-perl-static-reference.utils';

export const RUBY_STATIC_NAME_PATTERN = '(?:@@?[a-z_][A-Za-z0-9_]*|\\$[A-Za-z_][A-Za-z0-9_]*|[a-z_][A-Za-z0-9_]*|(?:[A-Z][A-Za-z0-9_]*)(?:::[A-Z][A-Za-z0-9_]*)*)';

type RubyStaticListValues = {
  values: string[];
  endIndex: number;
};

type RubyStaticListValueAssignment = {
  name: string;
  values: string[] | null;
  endIndex: number;
};

export function rubyStaticListAssignments(
  code: string,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
): RubyPerlStaticStringAssignment[] {
  const assignments: RubyPerlStaticStringAssignment[] = [];
  const listAssignments = rubyStaticListValueAssignments(code, operators, literalReaders);
  const pattern = new RegExp(`(?:^|[;\\n])\\s*(${RUBY_STATIC_NAME_PATTERN}(?:\\s*,\\s*${RUBY_STATIC_NAME_PATTERN})+)\\s*=\\s*`, 'g');

  for (const match of code.matchAll(pattern)) {
    const names = rubyStaticListAssignmentNames(match[1]);
    if (names.length < 2) continue;

    const valueStart = Number(match.index) + match[0].length;
    const values = readRubyStaticListValues(code, valueStart, operators, literalReaders, listAssignments);
    const endIndex = values?.endIndex ?? valueStart;
    const isBoundary = values && rubyListAssignmentValueBoundary(code, endIndex);

    names.forEach((assignmentName, index) => assignments.push({
      name: assignmentName,
      value: isBoundary ? values.values[index] ?? null : null,
      endIndex,
    }));
  }

  return assignments;
}

function rubyStaticListValueAssignments(
  code: string,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
): RubyStaticListValueAssignment[] {
  const assignments: RubyStaticListValueAssignment[] = [];
  const pattern = new RegExp(`(?:^|[;\\n])\\s*(${RUBY_STATIC_NAME_PATTERN})\\s*=\\s*`, 'g');

  for (const match of code.matchAll(pattern)) {
    const valueStart = Number(match.index) + match[0].length;
    const values = readRubyStaticListLiteralValues(code, valueStart, operators, literalReaders);
    const endIndex = values?.endIndex ?? valueStart;
    assignments.push({
      name: match[1],
      values: values && rubyListAssignmentValueBoundary(code, endIndex) ? values.values : null,
      endIndex,
    });
  }

  return assignments;
}

function rubyStaticListAssignmentNames(source: string): string[] {
  const names = source.split(',').map((part) => part.trim());
  return names.every((name) => new RegExp(`^${RUBY_STATIC_NAME_PATTERN}$`).test(name)) ? names : [];
}

function readRubyStaticListValues(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
  listAssignments: RubyStaticListValueAssignment[],
): RubyStaticListValues | null {
  const cursor = skipWhitespace(source, startIndex);
  const reference = readRubyStaticListReference(source, cursor, listAssignments);
  if (reference) return reference;

  return readRubyStaticListLiteralValues(source, cursor, operators, literalReaders) ??
    readRubyStaticValueSequence(source, cursor, operators, literalReaders);
}

function readRubyStaticListLiteralValues(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
): RubyStaticListValues | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '[') return readBracketedRubyStaticListValues(source, cursor, operators, literalReaders);

  const wordList = readRubyPercentWordListLiteral(source, cursor);
  if (wordList) return { values: wordList.values, endIndex: wordList.endIndex };

  return null;
}

function readRubyStaticListReference(
  source: string,
  startIndex: number,
  listAssignments: RubyStaticListValueAssignment[],
): RubyStaticListValues | null {
  const match = source.slice(startIndex).match(new RegExp(`^(${RUBY_STATIC_NAME_PATTERN})`));
  if (!match) return null;

  const endIndex = startIndex + match[1].length - 1;
  if (!rubyReferenceBoundary(source, endIndex)) return null;

  const assignment = [...listAssignments]
    .reverse()
    .find((candidate) => candidate.name === match[1] && candidate.endIndex <= startIndex);
  return assignment?.values ? { values: assignment.values, endIndex } : null;
}

function readBracketedRubyStaticListValues(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
): RubyStaticListValues | null {
  const values = readRubyStaticValueSequence(source, startIndex + 1, operators, literalReaders, [']']);
  if (!values) return null;

  const cursor = skipWhitespace(source, values.endIndex + 1);
  return source[cursor] === ']' ? { values: values.values, endIndex: cursor } : null;
}

function readRubyStaticValueSequence(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
  terminators: string[] = [],
): RubyStaticListValues | null {
  let cursor = skipWhitespace(source, startIndex);
  const values: string[] = [];

  while (cursor < source.length) {
    if (terminators.includes(source[cursor])) {
      return values.length > 0 ? { values, endIndex: cursor - 1 } : null;
    }

    const value = readStaticInterpreterString(source, cursor, operators, { literalReaders });
    if (!value) return values.length > 0 ? { values, endIndex: cursor - 1 } : null;

    values.push(value.value);
    cursor = skipWhitespace(source, value.endIndex + 1);
    if (source[cursor] !== ',') return { values, endIndex: value.endIndex };
    cursor = skipWhitespace(source, cursor + 1);
  }

  return values.length > 0 ? { values, endIndex: source.length - 1 } : null;
}

function rubyListAssignmentValueBoundary(source: string, endIndex: number): boolean {
  const cursor = skipWhitespace(source, endIndex + 1);
  return cursor >= source.length || source[cursor] === ';' || source[cursor] === '\n';
}

function rubyReferenceBoundary(source: string, endIndex: number): boolean {
  const cursor = skipWhitespace(source, endIndex + 1);
  return cursor >= source.length || source[cursor] === ';' || source[cursor] === '\n';
}

function skipWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
