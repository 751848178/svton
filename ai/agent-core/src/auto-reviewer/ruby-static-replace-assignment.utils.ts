import {
  readStaticInterpreterString,
  type InterpreterStringConcatOperator,
  type InterpreterStringLiteralReader,
} from './interpreter-static-string.utils';
import type { RubyPerlStaticStringAssignment } from './ruby-perl-static-reference.utils';
import { RUBY_STATIC_NAME_PATTERN } from './ruby-static-list-assignment.utils';

export function rubyStaticReplaceAssignments(
  code: string,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
  methodNames: string[],
  prependMethodNames: string[],
): RubyPerlStaticStringAssignment[] {
  const replaceAssignments: RubyPerlStaticStringAssignment[] = [];
  const pattern = new RegExp(`(?:^|[;\\n])\\s*(${RUBY_STATIC_NAME_PATTERN})\\s*\\.replace\\s*\\(`, 'g');

  for (const match of code.matchAll(pattern)) {
    const name = match[1];
    const valueStart = Number(match.index) + match[0].length;
    const value = readStaticInterpreterString(code, valueStart, operators, {
      literalReaders,
      methodNames,
      prependMethodNames,
    });
    const closeIndex = value ? skipWhitespace(code, value.endIndex + 1) : valueStart;
    const isBoundary = value && code[closeIndex] === ')' && assignmentValueBoundary(code, closeIndex);
    replaceAssignments.push({
      name,
      value: isBoundary ? value.value : null,
      endIndex: isBoundary ? closeIndex : valueStart,
    });
  }

  return replaceAssignments;
}

function assignmentValueBoundary(source: string, endIndex: number): boolean {
  const cursor = skipWhitespace(source, endIndex + 1);
  return cursor >= source.length || source[cursor] === ';' || source[cursor] === '\n';
}

function skipWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
