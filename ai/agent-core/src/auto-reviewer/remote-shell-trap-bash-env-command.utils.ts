import { bashEnvStartupCommandStrings } from './shell-bash-env-command-string.utils';
import { cloneBashEnvState } from './shell-bash-env-function-state.utils';
import { type BashEnvState } from './shell-bash-env-static-variable.utils';
import { expandShellCommandStringPositionals } from './shell-command-string-positionals.utils';
import { type ShellFunctionDefinitions } from './shell-function-command.utils';
import {
  type ShellTrapActionCommand,
  resolveShellTrapActionCommand,
} from './shell-trap-action-command.utils';
import {
  shellTrapCommandHasSignal,
  shellTrapCommandIsExit,
} from './shell-trap-command-state.utils';

type TokensStartWithShell = (tokens: string[]) => boolean;
type TokenResolvesToShell = (token: string) => boolean;
type RemoteFetchDetector = (command: string, depth: number) => boolean;

export interface TrapRemoteFetchContext {
  shellFunctions: ShellFunctionDefinitions;
  depth: number;
  tokensStartWithShell: TokensStartWithShell;
  tokenResolvesToShell: TokenResolvesToShell;
  receivesRemoteFetch: RemoteFetchDetector;
  state: BashEnvState;
  workingDir?: string;
}

export function signalTrapCommandsReceiveRemoteFetch(
  trapCommands: ShellTrapActionCommand[],
  signal: string,
  context: TrapRemoteFetchContext,
): boolean {
  return trapCommands
    .filter((trapCommand) => shellTrapCommandHasSignal(trapCommand, signal))
    .some((trapCommand) => triggeredTrapCommandReceivesRemoteFetch(trapCommand, context));
}

export function exitTrapCommandReceivesRemoteFetch(
  trapCommands: ShellTrapActionCommand[],
  context: TrapRemoteFetchContext,
): boolean {
  return trapCommands
    .filter(shellTrapCommandIsExit)
    .some((trapCommand) => triggeredTrapCommandReceivesRemoteFetch(trapCommand, context));
}

function triggeredTrapCommandReceivesRemoteFetch(
  trapCommand: ShellTrapActionCommand,
  context: TrapRemoteFetchContext,
): boolean {
  const resolved = resolveShellTrapActionCommand(trapCommand, context.shellFunctions);
  const command = trapActionCommand(resolved);
  return trapActionBashEnvReceivesRemoteFetch(command, context)
    || context.receivesRemoteFetch(command, context.depth + 1);
}

function trapActionCommand(trapCommand: ShellTrapActionCommand): string {
  return expandShellCommandStringPositionals(trapCommand.command, trapCommand.positionals);
}

function trapActionBashEnvReceivesRemoteFetch(
  command: string,
  context: TrapRemoteFetchContext,
): boolean {
  return bashEnvStartupCommandStrings(
    command,
    context.tokensStartWithShell,
    context.tokenResolvesToShell,
    { state: cloneBashEnvState(context.state), workingDir: context.workingDir ?? '' },
  ).some((script) => context.receivesRemoteFetch(script, context.depth + 1));
}
