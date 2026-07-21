import { trapCommandSpec } from './rm-trap-command.utils';
import {
  type ShellFunctionDefinitions,
  resolveShellFunctionCommand,
  shellFunctionInvocationPositionals,
} from './shell-function-command.utils';
import { type ShellPositionalArguments, shellPositionalTargetTokens } from './shell-positional-parameter.utils';
import { stripHereDocBodies } from './shell-script-input-command.utils';

type SplitCommandTokens = (command: string) => string[];

export interface ShellTrapActionCommand {
  action: string;
  command: string;
  signals: string[];
  parentPositionals?: ShellPositionalArguments;
  positionals?: ShellPositionalArguments;
}

export interface ShellTrapCommandUpdate {
  command: ShellTrapActionCommand | null;
  reset: boolean;
  signals: string[];
}

export function shellTrapActionCommand(
  tokens: string[],
  definitions: ShellFunctionDefinitions,
  positionals?: ShellPositionalArguments,
): ShellTrapActionCommand | null {
  return shellTrapCommandUpdate(tokens, definitions, positionals)?.command ?? null;
}

export function shellTrapCommandUpdate(
  tokens: string[],
  definitions: ShellFunctionDefinitions,
  positionals?: ShellPositionalArguments,
): ShellTrapCommandUpdate | null {
  const spec = trapCommandSpec(tokens);
  if (!spec) return null;
  return {
    command: spec.action
      ? shellTrapActionCommandFromAction(spec.action, spec.signals, definitions, positionals)
      : null,
    reset: spec.reset,
    signals: spec.signals,
  };
}

export function shellTrapActionCommandFromStatement(
  statement: string,
  definitions: ShellFunctionDefinitions,
  splitCommandTokens: SplitCommandTokens,
  positionals?: ShellPositionalArguments,
): ShellTrapActionCommand | null {
  const tokens = splitCommandTokens(stripHereDocBodies(statement))
    .flatMap((token) => shellPositionalTargetTokens(token, positionals));
  return shellTrapActionCommand(tokens, definitions, positionals);
}

export function shellTrapCommandUpdateFromStatement(
  statement: string,
  definitions: ShellFunctionDefinitions,
  splitCommandTokens: SplitCommandTokens,
  positionals?: ShellPositionalArguments,
): ShellTrapCommandUpdate | null {
  const tokens = splitCommandTokens(stripHereDocBodies(statement))
    .flatMap((token) => shellPositionalTargetTokens(token, positionals));
  return shellTrapCommandUpdate(tokens, definitions, positionals);
}

export function resolveShellTrapActionCommand(
  trapCommand: ShellTrapActionCommand,
  definitions: ShellFunctionDefinitions,
): ShellTrapActionCommand {
  return shellTrapActionCommandFromAction(
    trapCommand.action,
    trapCommand.signals,
    definitions,
    trapCommand.parentPositionals,
  ) ?? trapCommand;
}

function shellTrapActionCommandFromAction(
  action: string,
  signals: string[],
  definitions: ShellFunctionDefinitions,
  positionals?: ShellPositionalArguments,
): ShellTrapActionCommand | null {
  const resolvedCommand = resolveShellFunctionCommand(action, definitions);
  if (!resolvedCommand) return null;

  return {
    action,
    command: resolvedCommand,
    signals,
    parentPositionals: positionals,
    positionals: resolvedCommand === action
      ? positionals
      : shellFunctionInvocationPositionals(action, positionals),
  };
}
