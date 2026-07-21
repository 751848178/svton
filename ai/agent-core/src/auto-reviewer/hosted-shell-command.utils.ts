import { interpreterDirectCommandTokenGroups } from './interpreter-direct-command.utils';
import { interpreterShellCommandStrings } from './interpreter-shell-command.utils';
import { osascriptShellCommandStrings } from './osascript-shell-command.utils';
import { firstShellCommandString } from './shell-c-command.utils';
import { SHELL_COMMANDS } from './shell-command-name.constants';
import { getShellTokenBasename } from './shell-command.utils';

export function hostedShellCommandStrings(tokens: string[]): string[] {
  return [
    ...osascriptShellCommandStrings(tokens),
    ...interpreterShellCommandStrings(tokens),
    ...interpreterDirectShellCommandStrings(tokens),
  ];
}

export function hostedExecutableCommandTokenGroups(tokens: string[]): string[][] {
  return interpreterDirectCommandTokenGroups(tokens);
}

function interpreterDirectShellCommandStrings(tokens: string[]): string[] {
  return interpreterDirectCommandTokenGroups(tokens)
    .map((commandTokens) => firstShellCommandString(commandTokens, tokenResolvesToShell))
    .filter((command): command is string => Boolean(command));
}

function tokenResolvesToShell(token: string): boolean {
  return SHELL_COMMANDS.has(getShellTokenBasename(token));
}
