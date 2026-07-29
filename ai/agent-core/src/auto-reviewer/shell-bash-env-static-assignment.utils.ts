import { embeddedCommandSubstitutionOutputToken } from './command-substitution-embedded-token.utils';
import { staticCommandSubstitutionOutputToken } from './command-substitution-command-output.utils';
import { shellAssignmentPrefixName } from './shell-assignment-prefix.utils';
import {
  bashEnvStartupValueHasUnresolvedParameterExpansion,
  bashEnvValuePreservesStartupExpansion,
} from './shell-bash-env-startup-value.utils';
import { normalizeShellWordToken, unquoteShellToken } from './shell-command.utils';
import { substituteStaticShellVariables } from './shell-static-variable-command.utils';

export interface BashEnvAssignment {
  name: string;
  value: string;
  startupExpandable: boolean;
}

type BashEnvAssignmentContext = 'state' | 'command_prefix';

export function bashEnvStaticAssignment(
  token: string,
  variables: Map<string, string>,
  workingDir = '',
): BashEnvAssignment | null {
  return resolveBashEnvStaticAssignment(token, variables, 'state', workingDir);
}

export function bashEnvCommandPrefixAssignment(
  token: string,
  variables: Map<string, string>,
  workingDir = '',
): BashEnvAssignment | null {
  return resolveBashEnvStaticAssignment(token, variables, 'command_prefix', workingDir);
}

function resolveBashEnvStaticAssignment(
  token: string,
  variables: Map<string, string>,
  context: BashEnvAssignmentContext,
  workingDir: string,
): BashEnvAssignment | null {
  const name = shellAssignmentPrefixName(token);
  if (!name) return null;

  const separator = token.indexOf('=');
  const rawValue = token.slice(separator + 1);
  const append = token[separator - 1] === '+';
  const processSubstitution = isProcessSubstitutionAssignmentValue(rawValue);
  const value = bashEnvAssignmentWordValue(
    substituteStaticShellVariables(rawValue, variables),
    workingDir,
  );
  const existingValue = append ? variables.get(name) ?? '' : '';
  const retainsExistingValue = append && context === 'state';
  const finalValue = retainsExistingValue ? `${existingValue}${value}` : value;
  const expansionValue = processSubstitution && !retainsExistingValue
    ? ''
    : processSubstitution
      ? existingValue
      : finalValue;

  return {
    name,
    value: finalValue,
    startupExpandable:
      bashEnvStartupValueHasUnresolvedParameterExpansion(expansionValue)
      || (!processSubstitution && bashEnvValuePreservesStartupExpansion(rawValue)),
  };
}

export function bashEnvAssignmentWordValue(value: string, workingDir = ''): string {
  if (isProcessSubstitutionAssignmentValue(value)) return unquoteShellToken(value);
  return normalizeShellWordToken(
    embeddedCommandSubstitutionOutputToken(
      value,
      (command) => staticCommandSubstitutionOutputToken(command, workingDir),
    ) ?? value,
  );
}

export function bashEnvVariablesWithWorkingDir(
  variables: Map<string, string>,
  workingDir: string,
): Map<string, string> {
  const next = new Map(variables);
  if (workingDir.startsWith('/')) next.set('PWD', workingDir);
  return next;
}

function isProcessSubstitutionAssignmentValue(value: string): boolean {
  return value.startsWith('<(') || value.startsWith('>(');
}
