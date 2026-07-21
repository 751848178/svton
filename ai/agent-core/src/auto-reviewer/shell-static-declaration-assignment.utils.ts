import { mergeWholeCommandSubstitutionTokens } from './command-substitution-token.utils';
import { getShellTokenBasename, normalizeShellWordToken, splitShellWords } from './shell-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';
import { mergeStaticArrayAssignmentTokens, staticArrayAssignmentToken } from './shell-static-array-assignment.utils';
import type {
  StaticAssignmentCommandOptions,
  StaticShellAssignment,
} from './shell-static-assignment.types';
import { staticShellWordValue } from './shell-static-variable-command.utils';

export function staticShellAssignment(statement: string): StaticShellAssignment | null {
  const tokens = splitStaticAssignmentWords(statement);
  if (tokens.length !== 1) return null;

  return staticTokenAssignment(tokens[0], false);
}

export function staticDeclarationAssignments(
  statement: string,
  options: StaticAssignmentCommandOptions,
): StaticShellAssignment[] {
  const tokens = splitStaticAssignmentWords(statement);
  const command = getShellTokenBasename(tokens[0] ?? '');
  const declarationCommands = options.allowLocalDeclarations
    ? ['declare', 'export', 'local', 'readonly', 'typeset']
    : ['declare', 'export', 'readonly', 'typeset'];
  if (!declarationCommands.includes(command)) return [];

  let marksReadonly = command === 'readonly';
  let marksExported: boolean | undefined = command === 'export' ? true : undefined;
  let blocksAllexport = false;
  const assignments: StaticShellAssignment[] = [];
  for (const token of tokens.slice(1)) {
    const word = normalizeShellWordToken(token);
    if (word === '--') continue;
    if (word.startsWith('-') || word.startsWith('+')) {
      if (['declare', 'local', 'typeset'].includes(command) && word.includes('r')) marksReadonly = true;
      if (word.includes('x')) marksExported = !word.startsWith('+');
      if (command === 'export' && word.includes('n')) {
        marksExported = false;
        blocksAllexport = true;
      }
      continue;
    }

    const assignment = staticTokenAssignment(token, marksReadonly, marksExported, blocksAllexport)
      ?? staticDeclarationName(token, marksReadonly, marksExported, blocksAllexport);
    if (assignment) assignments.push(assignment);
  }

  return assignments;
}

function splitStaticAssignmentWords(statement: string): string[] {
  return mergeStaticArrayAssignmentTokens(
    mergeWholeCommandSubstitutionTokens(splitUnquotedIfsExpansionTokens(splitShellWords(statement))),
  );
}

function staticTokenAssignment(
  token: string,
  readonly: boolean,
  exported?: boolean,
  blocksAllexport = false,
): StaticShellAssignment | null {
  const arrayAssignment = staticArrayAssignmentToken(token, readonly, exported, blocksAllexport);
  if (arrayAssignment) return arrayAssignment;

  const separator = token.indexOf('=');
  if (separator <= 0) return null;

  const name = token.slice(0, separator);
  if (!/^[A-Za-z_]\w*$/.test(name)) return null;

  return {
    name,
    readonly,
    exported,
    blocksAllexport,
    value: staticShellWordValue(token.slice(separator + 1)),
  };
}

function staticDeclarationName(
  token: string,
  readonly: boolean,
  exported: boolean | undefined,
  blocksAllexport: boolean,
): StaticShellAssignment | null {
  const name = normalizeShellWordToken(token);
  if (!/^[A-Za-z_]\w*$/.test(name)) return null;

  return { name, readonly, exported, blocksAllexport };
}
