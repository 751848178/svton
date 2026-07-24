import {
  readStaticInterpreterString,
  type InterpreterStringConcatOperator,
  type InterpreterStringLiteralReader,
} from './interpreter-static-string.utils';
import type { InterpreterStringLiteral } from './interpreter-quote-like-string.utils';
import {
  PERL_STATIC_NAME_PATTERN,
  PERL_STATIC_TARGET_PATTERN,
  perlStaticListAssignments,
} from './perl-static-list-assignment.utils';
import {
  RUBY_STATIC_NAME_PATTERN,
  rubyStaticListAssignments,
} from './ruby-static-list-assignment.utils';
import { rubyStaticMutationAssignments } from './ruby-static-mutation-assignment.utils';

export type RubyPerlInterpreterName = 'ruby' | 'perl';

export type RubyPerlStaticStringAssignment = {
  name: string;
  value: string | null;
  endIndex: number;
};

export function rubyPerlStaticStringAssignments(
  code: string,
  name: RubyPerlInterpreterName,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
  methodNames: string[] = [],
  prependMethodNames: string[] = [],
): RubyPerlStaticStringAssignment[] {
  const assignments: RubyPerlStaticStringAssignment[] = [];
  const pattern = name === 'ruby'
    ? new RegExp(`(?:^|[;\\n])\\s*(${RUBY_STATIC_NAME_PATTERN})\\s*=\\s*`, 'g')
    : new RegExp(`(?:^|[;\\n])\\s*${PERL_STATIC_TARGET_PATTERN}\\s*=\\s*`, 'g');

  for (const match of code.matchAll(pattern)) {
    const valueStart = Number(match.index) + match[0].length;
    const value = readStaticInterpreterString(code, valueStart, operators, {
      literalReaders,
      methodNames,
      prependMethodNames,
    });
    assignments.push({
      name: perlAssignmentName(match, name),
      value: value && assignmentValueBoundary(code, value.endIndex) ? value.value : null,
      endIndex: value?.endIndex ?? valueStart,
    });
  }

  if (name === 'ruby') {
    assignments.push(...rubyStaticListAssignments(code, operators, literalReaders));
    assignments.push(...rubyStaticMutationAssignments(
      code,
      operators,
      literalReaders,
      methodNames,
      prependMethodNames,
      assignments,
    ));
  }
  if (name === 'perl') {
    assignments.push(...perlStaticListAssignments(code, operators, literalReaders));
  }
  return assignments.sort((left, right) => left.endIndex - right.endIndex);
}

function perlAssignmentName(match: RegExpMatchArray, name: RubyPerlInterpreterName): string {
  return name === 'ruby' ? match[1] : (match[1] ?? match[2]);
}


export function rubyPerlStaticReferenceReader(
  name: RubyPerlInterpreterName,
  operators: InterpreterStringConcatOperator[],
  assignments: RubyPerlStaticStringAssignment[],
  extraBoundaries: string[] = [],
): InterpreterStringLiteralReader {
  return (source, startIndex) =>
    readStaticReference(source, startIndex, name, operators, assignments, extraBoundaries);
}

function readStaticReference(
  source: string,
  startIndex: number,
  name: RubyPerlInterpreterName,
  operators: InterpreterStringConcatOperator[],
  assignments: RubyPerlStaticStringAssignment[],
  extraBoundaries: string[],
): InterpreterStringLiteral | null {
  const cursor = skipWhitespace(source, startIndex);
  if (source[cursor] === '(') {
    return readParenthesizedStaticReference(source, cursor, name, operators, assignments, extraBoundaries);
  }

  const pattern = name === 'ruby' ? RUBY_STATIC_NAME_PATTERN : PERL_STATIC_NAME_PATTERN;
  const match = source.slice(cursor).match(new RegExp(`^(${pattern})`));
  if (!match) return null;

  const endIndex = cursor + match[1].length - 1;
  if (!referenceBoundary(source, endIndex, operators, extraBoundaries)) return null;

  const assignment = [...assignments]
    .reverse()
    .find((candidate) => candidate.name === match[1] && candidate.endIndex <= cursor);
  return assignment?.value ? { value: assignment.value, endIndex } : null;
}

function readParenthesizedStaticReference(
  source: string,
  startIndex: number,
  name: RubyPerlInterpreterName,
  operators: InterpreterStringConcatOperator[],
  assignments: RubyPerlStaticStringAssignment[],
  extraBoundaries: string[],
): InterpreterStringLiteral | null {
  const inner = readStaticReference(source, startIndex + 1, name, operators, assignments, extraBoundaries);
  if (!inner) return null;

  const closeIndex = skipWhitespace(source, inner.endIndex + 1);
  if (source[closeIndex] !== ')' || !referenceBoundary(source, closeIndex, operators, extraBoundaries)) return null;
  return { value: inner.value, endIndex: closeIndex };
}

function assignmentValueBoundary(source: string, endIndex: number): boolean {
  const cursor = skipWhitespace(source, endIndex + 1);
  return cursor >= source.length || source[cursor] === ';' || source[cursor] === '\n';
}

function referenceBoundary(
  source: string,
  endIndex: number,
  operators: InterpreterStringConcatOperator[],
  extraBoundaries: string[],
): boolean {
  const cursor = skipWhitespace(source, endIndex + 1);
  return source[cursor] === ')' ||
    source[cursor] === ',' ||
    extraBoundaries.includes(source[cursor]) ||
    operators.includes(source[cursor] as InterpreterStringConcatOperator);
}

function skipWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}
