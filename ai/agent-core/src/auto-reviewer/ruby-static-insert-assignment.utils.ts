import {
  readStaticInterpreterString,
  type InterpreterStringConcatOperator,
  type InterpreterStringLiteralReader,
} from './interpreter-static-string.utils';
import { readStaticIntegerExpression, skipRubyWhitespace } from './ruby-static-integer-expression.utils';
import type { RubyPerlStaticStringAssignment } from './ruby-perl-static-reference.utils';
import { RUBY_STATIC_NAME_PATTERN } from './ruby-static-list-assignment.utils';

export function rubyStaticInsertAssignments(
  code: string,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
  methodNames: string[],
  prependMethodNames: string[],
  assignments: RubyPerlStaticStringAssignment[],
): RubyPerlStaticStringAssignment[] {
  const insertAssignments: RubyPerlStaticStringAssignment[] = [];
  const pattern = new RegExp(`(?:^|[;\\n])\\s*(${RUBY_STATIC_NAME_PATTERN})\\s*\\.insert\\s*\\(`, 'g');

  for (const match of code.matchAll(pattern)) {
    const name = match[1];
    const valueStart = Number(match.index) + match[0].length;
    const previous = latestAssignment([...assignments, ...insertAssignments], name, valueStart);
    const value = readInsertArguments(code, valueStart, operators, {
      literalReaders,
      methodNames,
      prependMethodNames,
    });
    const isBoundary = value && assignmentValueBoundary(code, value.endIndex);
    insertAssignments.push({
      name,
      value: previous?.value && isBoundary ? insertValue(previous.value, value.index, value.value) : null,
      endIndex: isBoundary ? value.endIndex : valueStart,
    });
  }

  return insertAssignments;
}

function latestAssignment(
  assignments: RubyPerlStaticStringAssignment[],
  name: string,
  cursor: number,
): RubyPerlStaticStringAssignment | undefined {
  return [...assignments]
    .reverse()
    .find((candidate) => candidate.name === name && candidate.endIndex <= cursor);
}

function insertValue(source: string, index: number, value: string): string | null {
  const insertIndex = normalizeInsertIndex(source, index);
  if (insertIndex === null) return null;
  return source.slice(0, insertIndex) + value + source.slice(insertIndex);
}

function normalizeInsertIndex(source: string, index: number): number | null {
  const insertIndex = index < 0 ? source.length + index + 1 : index;
  return insertIndex >= 0 && insertIndex <= source.length ? insertIndex : null;
}

function readInsertArguments(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  options: {
    literalReaders: InterpreterStringLiteralReader[];
    methodNames: string[];
    prependMethodNames: string[];
  },
): { index: number; value: string; endIndex: number } | null {
  const index = readStaticIntegerArgument(source, startIndex);
  if (!index) return null;

  const value = readStaticInterpreterString(source, index.nextIndex, operators, options);
  if (!value) return null;
  const closeIndex = skipRubyWhitespace(source, value.endIndex + 1);
  return source[closeIndex] === ')' ? { index: index.value, value: value.value, endIndex: closeIndex } : null;
}

function readStaticIntegerArgument(source: string, startIndex: number): { value: number; nextIndex: number } | null {
  const cursor = skipRubyWhitespace(source, startIndex);
  const value = readStaticIntegerExpression(source, cursor);
  if (!value) return null;

  const commaIndex = skipRubyWhitespace(source, value.endIndex);
  if (source[commaIndex] !== ',') return null;
  return { value: value.value, nextIndex: commaIndex + 1 };
}

function assignmentValueBoundary(source: string, endIndex: number): boolean {
  const cursor = skipRubyWhitespace(source, endIndex + 1);
  return cursor >= source.length || source[cursor] === ';' || source[cursor] === '\n';
}
