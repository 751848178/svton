import {
  expandShellFunctionCommand,
  resolveShellFunctionCommand,
  type ShellFunctionDefinitions,
} from './shell-function-command.utils';
import { staticShellCommandExecutionStatus } from './shell-static-command-execution-status.utils';
import type { StaticShellCommandExecutionStatus } from './shell-static-command-status.types';
import { staticShellFunctionCommandStatus } from './shell-static-command-status.utils';
import {
  applyStaticFunctionState,
} from './shell-static-function-assignment.utils';
import type {
  StaticAssignmentCommandOptions,
  StaticVariableState,
} from './shell-static-assignment.types';

type ApplyStaticVariableState = (
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
) => void;

export function applyStaticFunctionInvocationState(
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  shellFunctions: ShellFunctionDefinitions,
  applyStaticVariableState: ApplyStaticVariableState,
): boolean {
  const shellCommand = resolveShellFunctionCommand(statement, shellFunctions);
  if (shellCommand === null) return true;
  if (shellCommand === statement) return false;

  applyStaticFunctionState(
    expandShellFunctionCommand(statement, shellCommand),
    state,
    options,
    shellFunctions,
    applyStaticVariableState,
  );
  return true;
}

export function staticFunctionAwareCommandExecutionStatus(
  statement: string,
  state: StaticVariableState,
  shellFunctions?: ShellFunctionDefinitions,
): StaticShellCommandExecutionStatus {
  if (!shellFunctions) return staticShellCommandExecutionStatus(statement, state.shellOptions);

  const shellCommand = resolveShellFunctionCommand(statement, shellFunctions);
  if (shellCommand === null) return { status: true, exitsOnErrexit: false };
  if (shellCommand === statement) return staticShellCommandExecutionStatus(statement, state.shellOptions);

  return {
    status: staticShellFunctionCommandStatus(statement, shellCommand, state.shellOptions),
    exitsOnErrexit: true,
  };
}
