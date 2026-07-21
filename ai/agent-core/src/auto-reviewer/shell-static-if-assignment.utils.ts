import {
  shellIfStatement,
  staticShellIfConditionResult,
} from './shell-if-parser.utils';
import {
  expandShellFunctionCommand,
  resolveShellFunctionCommand,
  type ShellFunctionDefinitions,
} from './shell-function-command.utils';
import type { StaticAssignmentCommandOptions, StaticVariableState } from './shell-static-assignment.types';
import { applyStaticCommandListState } from './shell-static-command-list-assignment.utils';
import { staticShellCommandExecutionStatus } from './shell-static-command-execution-status.utils';
import { staticFunctionAwareCommandExecutionStatus } from './shell-static-function-invocation-assignment.utils';
import type { StaticShellCommandStatus } from './shell-static-command-status.types';
import {
  applyStaticFunctionState,
} from './shell-static-function-assignment.utils';
import {
  staticShellFunctionCommandStatus,
} from './shell-static-command-status.utils';
import { withStaticErrexitSuppressed } from './shell-static-errexit-suppression.utils';
import { substituteStaticShellVariables } from './shell-static-variable-command.utils';

type ApplyStaticVariableState = (
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  evalDepth?: number,
  shellFunctions?: ShellFunctionDefinitions,
) => void;

export function applyStaticIfState(
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  applyStaticVariableState: ApplyStaticVariableState,
  shellFunctions?: ShellFunctionDefinitions,
): boolean {
  const ifCommand = shellIfStatement(statement);
  if (!ifCommand) return false;

  const condition = substituteStaticShellVariables(ifCommand.condition, state.values, state.unsetNames);
  const conditionResult = applyStaticIfConditionState(
    condition,
    state,
    options,
    applyStaticVariableState,
    shellFunctions,
  );
  if (conditionResult === null) return true;

  const body = conditionResult ? ifCommand.thenBody : ifCommand.elseBody;
  if (!body) return true;

  applyStaticCommandListState(body, (bodyStatement) => {
    const expanded = substituteStaticShellVariables(bodyStatement, state.values, state.unsetNames);
    applyStaticVariableState(expanded, state, options, undefined, shellFunctions);
    return staticFunctionAwareCommandExecutionStatus(expanded, state, shellFunctions);
  }, state.shellOptions);

  return true;
}

function applyStaticIfConditionState(
  condition: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  applyStaticVariableState: ApplyStaticVariableState,
  shellFunctions?: ShellFunctionDefinitions,
): StaticShellCommandStatus {
  return withStaticErrexitSuppressed(state, () => {
    const functionStatus = applyStaticIfConditionFunctionState(
      condition,
      state,
      options,
      applyStaticVariableState,
      shellFunctions,
    );
    if (functionStatus !== null) return functionStatus;

    applyStaticVariableState(condition, state, options);
    const status = staticShellCommandExecutionStatus(condition, state.shellOptions).status;
    return status ?? staticShellIfConditionResult(condition);
  });
}

function applyStaticIfConditionFunctionState(
  condition: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  applyStaticVariableState: ApplyStaticVariableState,
  shellFunctions?: ShellFunctionDefinitions,
): StaticShellCommandStatus {
  if (!shellFunctions) return null;

  const shellCommand = resolveShellFunctionCommand(condition, shellFunctions);
  if (shellCommand === null || shellCommand === condition) return null;

  applyStaticFunctionState(
    expandShellFunctionCommand(condition, shellCommand),
    state,
    options,
    shellFunctions,
    applyStaticVariableState,
  );
  return staticShellFunctionCommandStatus(condition, shellCommand, state.shellOptions);
}
