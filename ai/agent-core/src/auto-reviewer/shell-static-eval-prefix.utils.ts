import { shellAssignmentPrefixName } from './shell-assignment-prefix.utils';
import { splitShellWords } from './shell-command.utils';
import { splitStaticAssignmentCommandStatements } from './shell-static-assignment-statement.utils';
import type { StaticVariableState } from './shell-static-assignment.types';
import { applyStaticAssignmentState } from './shell-static-assignment-state.utils';
import {
  staticDeclarationAssignments,
  staticShellAssignment,
} from './shell-static-declaration-assignment.utils';
import type { StaticNameSnapshot } from './shell-static-name-snapshot.utils';

export function staticEvalAssignmentPrefixNames(prefixes: string[]): Set<string> {
  const names = new Set<string>();
  for (const prefix of prefixes) {
    const name = shellAssignmentPrefixName(prefix);
    if (name) names.add(name);
  }
  return names;
}

export function applyStaticEvalAssignmentPrefixes(
  prefixes: string[],
  state: StaticVariableState,
): void {
  for (const prefix of prefixes) {
    const assignment = staticShellAssignment(prefix);
    if (assignment) applyStaticAssignmentState(assignment, state);
  }
}

export function staticEvalCommandMutatedNames(
  statement: string,
  names: Set<string>,
): Set<string> {
  const mutated = new Set<string>();
  for (const { statement: segment } of splitStaticAssignmentCommandStatements(statement)) {
    const assignment = staticShellAssignment(segment);
    if (assignment && names.has(assignment.name)) mutated.add(assignment.name);
    staticDeclarationAssignments(segment, { allowLocalDeclarations: true })
      .forEach((declaration) => {
        if (names.has(declaration.name)) mutated.add(declaration.name);
      });
    staticUnsetNames(segment).forEach((name) => {
      if (names.has(name)) mutated.add(name);
    });
  }
  return mutated;
}

export function restoredStaticEvalPrefixSnapshots(
  snapshots: Map<string, StaticNameSnapshot>,
  mutatedNames: Set<string>,
  wrapper: 'builtin' | 'command' | null,
): Map<string, StaticNameSnapshot> {
  if (wrapper !== 'builtin') return snapshots;
  return new Map([...snapshots].filter(([name]) => !mutatedNames.has(name)));
}

function staticUnsetNames(statement: string): string[] {
  const tokens = splitShellWords(statement);
  if (tokens[0] !== 'unset') return [];
  return tokens.slice(1).filter((token) => /^[A-Za-z_]\w*$/.test(token));
}
