import { splitShellWords } from './shell-command.utils';
import type { StaticShellCommandStatus } from './shell-static-command-status.types';

export interface ShellCommandNegation {
  count: number;
  tokens: string[];
}

export function shellCommandNegation(tokens: string[]): ShellCommandNegation {
  let count = 0;
  while (tokens[count] === '!') count += 1;
  return { count, tokens: tokens.slice(count) };
}

export function stripShellCommandNegation(statement: string): ShellCommandNegation {
  return shellCommandNegation(splitShellWords(statement));
}

export function applyShellCommandNegationStatus(
  status: StaticShellCommandStatus,
  count: number,
): StaticShellCommandStatus {
  if (status === null) return null;
  return count % 2 === 0 ? status : !status;
}
