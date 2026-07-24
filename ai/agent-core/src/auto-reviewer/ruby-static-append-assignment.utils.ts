import {
  readStaticInterpreterString,
  type InterpreterStringConcatOperator,
  type InterpreterStringLiteralReader,
} from './interpreter-static-string.utils';
import type { RubyPerlStaticStringAssignment } from './ruby-perl-static-reference.utils';
import { RUBY_STATIC_NAME_PATTERN } from './ruby-static-list-assignment.utils';

export function rubyStaticAppendAssignments(
  code: string,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
  methodNames: string[],
  prependMethodNames: string[],
  assignments: RubyPerlStaticStringAssignment[],
): RubyPerlStaticStringAssignment[] {
  const appendAssignments: RubyPerlStaticStringAssignment[] = [];
  const pattern = new RegExp(`(?:^|[;\\n])\\s*(${RUBY_STATIC_NAME_PATTERN})\\s*<<\\s*`, 'g');

  for (const match of code.matchAll(pattern)) {
    const name = match[1];
    const valueStart = Number(match.index) + match[0].length;
    const previous = latestAssignment([...assignments, ...appendAssignments], name, valueStart);
    const value = readStaticAppendValue(code, valueStart, operators, literalReaders, methodNames, prependMethodNames);
    const isBoundary = value && assignmentValueBoundary(code, value.endIndex);
    appendAssignments.push({
      name,
      value: previous?.value && isBoundary ? previous.value + value.value : null,
      endIndex: value?.endIndex ?? valueStart,
    });
  }

  return appendAssignments;
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

function assignmentValueBoundary(source: string, endIndex: number): boolean {
  const cursor = skipWhitespace(source, endIndex + 1);
  return cursor >= source.length || source[cursor] === ';' || source[cursor] === '\n';
}

function readStaticAppendValue(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
  methodNames: string[],
  prependMethodNames: string[],
): { value: string; endIndex: number } | null {
  const first = readStaticInterpreterString(source, startIndex, operators, {
    literalReaders,
    methodNames,
    prependMethodNames,
  });
  if (!first) return null;

  let value = first.value;
  let endIndex = first.endIndex;
  while (true) {
    const nextStart = skipAppendOperator(source, endIndex + 1);
    if (nextStart === null) return { value, endIndex };

    const next = readStaticInterpreterString(source, nextStart, operators, {
      literalReaders,
      methodNames,
      prependMethodNames,
    });
    if (!next) return null;
    value += next.value;
    endIndex = next.endIndex;
  }
}

function skipAppendOperator(source: string, startIndex: number): number | null {
  const cursor = skipWhitespace(source, startIndex);
  return source.startsWith('<<', cursor) ? cursor + 2 : null;
}

function skipWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
