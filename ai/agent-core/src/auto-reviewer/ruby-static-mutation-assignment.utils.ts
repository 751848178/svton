import {
  type InterpreterStringConcatOperator,
  type InterpreterStringLiteralReader,
} from './interpreter-static-string.utils';
import type { RubyPerlStaticStringAssignment } from './ruby-perl-static-reference.utils';
import { rubyStaticAppendAssignments } from './ruby-static-append-assignment.utils';
import { rubyStaticConcatAssignments } from './ruby-static-concat-assignment.utils';
import { rubyStaticInsertAssignments } from './ruby-static-insert-assignment.utils';
import { RUBY_STATIC_NAME_PATTERN } from './ruby-static-list-assignment.utils';
import { rubyStaticPrependAssignments } from './ruby-static-prepend-assignment.utils';
import { rubyStaticReplaceAssignments } from './ruby-static-replace-assignment.utils';

export function rubyStaticMutationAssignments(
  code: string,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
  methodNames: string[],
  prependMethodNames: string[],
  seedAssignments: RubyPerlStaticStringAssignment[],
): RubyPerlStaticStringAssignment[] {
  const assignments = new Map<string, RubyPerlStaticStringAssignment>();
  const maxPasses = Math.max(1, rubyMutationCandidateCount(code));

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const visibleAssignments = [...seedAssignments, ...assignments.values()]
      .sort((left, right) => left.endIndex - right.endIndex);
    const changed = collectPass(
      assignments,
      code,
      operators,
      literalReaders,
      methodNames,
      prependMethodNames,
      visibleAssignments,
    );
    if (!changed) break;
  }

  return [...assignments.values()].sort((left, right) => left.endIndex - right.endIndex);
}

function collectPass(
  assignments: Map<string, RubyPerlStaticStringAssignment>,
  code: string,
  operators: InterpreterStringConcatOperator[],
  literalReaders: InterpreterStringLiteralReader[],
  methodNames: string[],
  prependMethodNames: string[],
  visibleAssignments: RubyPerlStaticStringAssignment[],
): boolean {
  return [
    ...rubyStaticReplaceAssignments(code, operators, literalReaders, methodNames, prependMethodNames),
    ...rubyStaticAppendAssignments(
      code,
      operators,
      literalReaders,
      methodNames,
      prependMethodNames,
      visibleAssignments,
    ),
    ...rubyStaticConcatAssignments(
      code,
      operators,
      literalReaders,
      methodNames,
      prependMethodNames,
      visibleAssignments,
    ),
    ...rubyStaticInsertAssignments(
      code,
      operators,
      literalReaders,
      methodNames,
      prependMethodNames,
      visibleAssignments,
    ),
    ...rubyStaticPrependAssignments(
      code,
      operators,
      literalReaders,
      methodNames,
      prependMethodNames,
      visibleAssignments,
    ),
  ].reduce((changed, assignment) => upsertAssignment(assignments, assignment) || changed, false);
}

function upsertAssignment(
  assignments: Map<string, RubyPerlStaticStringAssignment>,
  assignment: RubyPerlStaticStringAssignment,
): boolean {
  const key = `${assignment.name}:${assignment.endIndex}`;
  const previous = assignments.get(key);
  if (previous?.value === assignment.value) return false;

  assignments.set(key, assignment);
  return true;
}

function rubyMutationCandidateCount(code: string): number {
  const pattern = new RegExp(`${RUBY_STATIC_NAME_PATTERN}\\s*(?:<<|\\.(?:replace|concat|insert|prepend)\\s*\\()`, 'g');
  return [...code.matchAll(pattern)].length;
}
