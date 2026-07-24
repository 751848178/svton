import {
  readStaticInterpreterString,
  type InterpreterStringConcatOperator,
  type InterpreterStringLiteralReader,
} from './interpreter-static-string.utils';
import type { RubyPerlStaticStringAssignment } from './ruby-perl-static-reference.utils';
import { RUBY_STATIC_NAME_PATTERN } from './ruby-static-list-assignment.utils';

export function rubyStaticPrependAssignments(
  code: string,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
  methodNames: string[],
  prependMethodNames: string[],
  assignments: RubyPerlStaticStringAssignment[],
): RubyPerlStaticStringAssignment[] {
  const prependAssignments: RubyPerlStaticStringAssignment[] = [];
  const pattern = new RegExp(`(?:^|[;\\n])\\s*(${RUBY_STATIC_NAME_PATTERN})\\s*\\.prepend\\s*\\(`, 'g');

  for (const match of code.matchAll(pattern)) {
    const name = match[1];
    const valueStart = Number(match.index) + match[0].length;
    const previous = latestAssignment([...assignments, ...prependAssignments], name, valueStart);
    const value = readStaticPrependArguments(code, valueStart, operators, {
      literalReaders,
      methodNames,
      prependMethodNames,
    });
    const isBoundary = value && assignmentValueBoundary(code, value.endIndex);
    prependAssignments.push({
      name,
      value: previous?.value && isBoundary ? value.value + previous.value : null,
      endIndex: isBoundary ? value.endIndex : valueStart,
    });
  }

  return prependAssignments;
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

function readStaticPrependArguments(
  source: string,
  startIndex: number,
  operators: InterpreterStringConcatOperator[],
  options: {
    literalReaders: InterpreterStringLiteralReader[];
    methodNames: string[];
    prependMethodNames: string[];
  },
): { value: string; endIndex: number } | null {
  let cursor = startIndex;
  let value = '';

  while (cursor < source.length) {
    const argument = readStaticInterpreterString(source, cursor, operators, options);
    if (!argument) return null;

    value += argument.value;
    const nextIndex = skipWhitespace(source, argument.endIndex + 1);
    if (source[nextIndex] === ',') {
      cursor = nextIndex + 1;
      continue;
    }
    return source[nextIndex] === ')' ? { value, endIndex: nextIndex } : null;
  }

  return null;
}

function skipWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
