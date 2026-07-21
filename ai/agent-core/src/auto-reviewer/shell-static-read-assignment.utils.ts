import { withoutShellAssignmentPrefixes } from './shell-assignment-prefix.utils';
import { getShellTokenBasename, splitShellWords } from './shell-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';
import type { StaticShellAssignment } from './shell-static-assignment.types';
import {
  staticReadHereString,
  staticReadValues,
  staticReadVariableNames,
} from './shell-static-read-command.utils';
import { staticShellWordValue } from './shell-static-variable-command.utils';

export function staticReadHereStringAssignments(statement: string): StaticShellAssignment[] {
  const tokens = splitUnquotedIfsExpansionTokens(
    withoutShellAssignmentPrefixes(splitShellWords(statement)),
  );
  if (getShellTokenBasename(tokens[0] ?? '') !== 'read') return [];

  const hereString = staticReadHereString(tokens);
  if (!hereString) return [];

  const names = staticReadVariableNames(tokens.slice(1, hereString.index), {
    allowPrompt: true,
  });
  if (!names) return [];

  const value = staticShellWordValue(hereString.word);
  if (value === null) return names.map((name) => staticReadAssignment(name, null));

  return staticReadValues(names, value).map(([name, field]) => staticReadAssignment(name, field));
}

function staticReadAssignment(name: string, value: string | null): StaticShellAssignment {
  return {
    name,
    value,
    readonly: false,
  };
}
