import type {
  InterpreterStringConcatOperator,
  InterpreterStringLiteralReader,
} from './interpreter-static-string.utils';
import {
  readRubyCommandArrayPairExpression,
  skipRubyWhitespace,
  type RubyCommandArrayPairExpression,
} from './ruby-command-array-literal.utils';

const RUBY_BARE_NAME_PATTERN = '[A-Za-z_][A-Za-z0-9_]*';
const RUBY_SIGILED_NAME_PATTERN = `(?:@@?[a-z_][A-Za-z0-9_]*|\\$${RUBY_BARE_NAME_PATTERN})`;
const RUBY_CONSTANT_PATH_PATTERN = `(?:::)?[A-Z][A-Za-z0-9_]*(?:::[A-Z][A-Za-z0-9_]*)*`;
const RUBY_STATIC_NAME_PATTERN = `(?:${RUBY_SIGILED_NAME_PATTERN}|[a-z_][A-Za-z0-9_]*|${RUBY_CONSTANT_PATH_PATTERN})`;

type RubyCommandArrayPairAssignment = {
  name: string;
  pair: RubyCommandArrayPairExpression | null;
  endIndex: number;
};

export function readRubyAssignedCommandArrayPair(
  source: string,
  startIndex: number,
  beforeIndex: number,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
): RubyCommandArrayPairExpression | null {
  const reference = readRubyStaticReferenceExpression(source, startIndex);
  if (!reference) return null;

  const assignment = rubyCommandArrayPairAssignments(
    source.slice(0, beforeIndex),
    operators,
    literalReaders,
  ).reverse().find((candidate) => rubyStaticNameKey(candidate.name) === rubyStaticNameKey(reference.name)
    && candidate.endIndex <= reference.startIndex);

  return assignment?.pair ? { command: assignment.pair.command, endIndex: reference.endIndex } : null;
}

function rubyCommandArrayPairAssignments(
  source: string,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
): RubyCommandArrayPairAssignment[] {
  const assignments: RubyCommandArrayPairAssignment[] = [];
  const pattern = new RegExp(`(?:^|[;\\n])\\s*(${RUBY_STATIC_NAME_PATTERN})\\s*=\\s*`, 'g');

  for (const match of source.matchAll(pattern)) {
    const valueStart = Number(match.index) + match[0].length;
    const pair = readRubyCommandArrayPairExpression(source, valueStart, operators, literalReaders, [';', '\n']);
    assignments.push({
      name: match[1],
      pair: pair && rubyAssignmentValueBoundary(source, pair.endIndex) ? pair : null,
      endIndex: pair?.endIndex ?? valueStart,
    });
  }

  return assignments;
}

function readRubyStaticReference(source: string, startIndex: number): { name: string; startIndex: number; endIndex: number } | null {
  const cursor = skipRubyWhitespace(source, startIndex);
  const match = source.slice(cursor).match(new RegExp(`^(${RUBY_STATIC_NAME_PATTERN})`));
  if (!match) return null;

  const endIndex = cursor + match[1].length - 1;
  return rubyReferenceBoundary(source, endIndex) ? { name: match[1], startIndex: cursor, endIndex } : null;
}

function readRubyStaticReferenceExpression(
  source: string,
  startIndex: number,
): { name: string; startIndex: number; endIndex: number } | null {
  const cursor = skipRubyWhitespace(source, startIndex);
  if (source[cursor] === '(') return readParenthesizedRubyStaticReference(source, cursor);
  return readRubyStaticReference(source, cursor);
}

function readParenthesizedRubyStaticReference(
  source: string,
  startIndex: number,
): { name: string; startIndex: number; endIndex: number } | null {
  const inner = readRubyStaticReferenceExpression(source, startIndex + 1);
  if (!inner) return null;

  const closeIndex = skipRubyWhitespace(source, inner.endIndex + 1);
  if (source[closeIndex] !== ')' || !rubyReferenceBoundary(source, closeIndex)) return null;

  return { name: inner.name, startIndex, endIndex: closeIndex };
}

function rubyAssignmentValueBoundary(source: string, endIndex: number): boolean {
  const cursor = skipRubyWhitespace(source, endIndex + 1);
  return cursor >= source.length || source[cursor] === ';' || source[cursor] === '\n';
}

function rubyReferenceBoundary(source: string, endIndex: number): boolean {
  const cursor = skipRubyWhitespace(source, endIndex + 1);
  return source[cursor] === ',' || source[cursor] === ')';
}

function rubyStaticNameKey(name: string): string {
  return name.replace(/^::/, '');
}
