import { getShellTokenBasename, normalizeShellWordToken } from './shell-command.utils';
import { formatStaticPrintfValue } from './shell-static-printf-format.utils';
import {
  staticReadHereString,
  staticReadValues,
  staticReadVariableNames,
} from './shell-static-read-command.utils';
import { substituteStaticShellVariables } from './shell-static-variable-command.utils';
import {
  bashEnvAssignmentWordValue,
  type BashEnvAssignment,
} from './shell-bash-env-static-assignment.utils';
import {
  applyBashEnvKnownAssignment,
  type BashEnvState,
} from './shell-bash-env-static-variable.utils';
import { bashEnvStartupValueHasUnresolvedParameterExpansion } from './shell-bash-env-startup-value.utils';

export function applyBashEnvStaticCommandAssignment(
  commandTokens: string[],
  state: BashEnvState,
): boolean {
  const commandName = getShellTokenBasename(commandTokens[0] ?? '');
  const assignments = commandName === 'printf'
    ? singleAssignment(staticPrintfAssignment(commandTokens, state))
    : staticReadAssignments(commandTokens, state);
  if (assignments.length === 0) return false;

  assignments.forEach((assignment) => applyBashEnvKnownAssignment(
    assignment,
    state,
    state.allexport || undefined,
  ));
  return true;
}

function singleAssignment(assignment: BashEnvAssignment | null): BashEnvAssignment[] {
  return assignment ? [assignment] : [];
}

function staticPrintfAssignment(
  tokens: string[],
  state: BashEnvState,
): BashEnvAssignment | null {
  if (normalizeShellWordToken(tokens[1] ?? '') !== '-v') return null;

  const name = normalizeShellWordToken(tokens[2] ?? '');
  if (!/^[A-Za-z_]\w*$/.test(name)) return null;

  const format = bashEnvStaticCommandWordValue(tokens[3], state);
  if (format === null) return null;

  const args = tokens.slice(4).map((token) => bashEnvStaticCommandWordValue(token, state));
  if (!allStaticWords(args)) return null;

  const value = formatStaticPrintfValue(format, args);
  return value === null ? null : generatedAssignment(name, value);
}

function staticReadAssignments(tokens: string[], state: BashEnvState): BashEnvAssignment[] {
  if (getShellTokenBasename(tokens[0] ?? '') !== 'read') return [];

  const hereString = staticReadHereString(tokens);
  if (!hereString) return [];

  const names = staticReadVariableNames(tokens.slice(1, hereString.index), {
    allowNulDelimiter: true,
    allowPrompt: true,
  });
  if (!names) return [];

  const value = bashEnvStaticCommandWordValue(hereString.word, state);
  if (value === null) return [];

  return staticReadValues(names, value)
    .map(([name, field]) => generatedAssignment(name, field));
}

function bashEnvStaticCommandWordValue(token: string | undefined, state: BashEnvState): string | null {
  if (!token) return null;
  return bashEnvAssignmentWordValue(substituteStaticShellVariables(token, state.variables));
}

function generatedAssignment(name: string, value: string): BashEnvAssignment {
  return {
    name,
    value,
    startupExpandable: bashEnvStartupValueHasUnresolvedParameterExpansion(value),
  };
}

function allStaticWords(values: Array<string | null>): values is string[] {
  return values.every((value) => value !== null);
}
