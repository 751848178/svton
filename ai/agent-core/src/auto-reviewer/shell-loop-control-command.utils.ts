import {
  getShellTokenBasename,
  normalizeShellWordToken,
  splitShellWords,
} from './shell-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';

export type ShellLoopControlCommand = 'break' | 'continue';

export function staticLoopControlCommand(statement: string): ShellLoopControlCommand | null {
  const tokens = splitUnquotedIfsExpansionTokens(splitShellWords(statement))
    .map(normalizeShellWordToken);
  const command = getShellTokenBasename(tokens[0] ?? '');
  if (command !== 'break' && command !== 'continue') return null;
  return tokens.length === 1 || tokens[1] === '1' ? command : null;
}
