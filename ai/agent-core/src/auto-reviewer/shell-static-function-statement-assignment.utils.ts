import type { ShellFunctionDefinitions } from './shell-function-command.utils';
import type { StaticAssignmentCommandOptions, StaticVariableState } from './shell-static-assignment.types';
import type { StaticFunctionCommandListResult, StaticFunctionCommandListStatementResult } from './shell-static-function-command-list-assignment.utils';
import { applyStaticFunctionCommandListState } from './shell-static-function-command-list-assignment.utils';
import {
  applyStaticFunctionEvalState,
  applyStaticFunctionGroupState,
} from './shell-static-function-compound-assignment.utils';
import {
  applyStaticFunctionCaseState,
  applyStaticFunctionIfState,
} from './shell-static-function-branch-assignment.utils';
import {
  applyStaticFunctionForLoopState,
  applyStaticFunctionWhileUntilState,
} from './shell-static-function-loop-assignment.utils';
import type {
  ApplyStaticFunctionVariableState,
  ReadStaticFunctionCommandExecutionStatus,
} from './shell-static-function-statement.types';
import { isStaticShellControlStatement } from './shell-static-control-statement.utils';
import { withExportedStaticEnvCommand } from './shell-static-exported-env-command.utils';
import { substituteStaticShellVariables } from './shell-static-variable-command.utils';

export function applyStaticFunctionStatementState(
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  shellFunctions: ShellFunctionDefinitions,
  applyStaticVariableState: ApplyStaticFunctionVariableState,
  readCommandStatus: ReadStaticFunctionCommandExecutionStatus,
): StaticFunctionCommandListStatementResult {
  const runCommandList = (command: string, nextState: StaticVariableState) => applyStaticFunctionCommandList(
    command,
    nextState,
    options,
    shellFunctions,
    applyStaticVariableState,
    readCommandStatus,
  );
  const applyStatement = (nextStatement: string, nextState: StaticVariableState) => applyStaticFunctionStatementState(
    nextStatement,
    nextState,
    options,
    shellFunctions,
    applyStaticVariableState,
    readCommandStatus,
  );
  const compoundResult = applyStaticFunctionIfState(statement, state, runCommandList)
    ?? applyStaticFunctionCaseState(statement, state, runCommandList)
    ?? applyStaticFunctionForLoopState(statement, state, applyStatement)
    ?? applyStaticFunctionWhileUntilState(statement, state, applyStatement, runCommandList)
    ?? applyStaticFunctionGroupState(statement, state, runCommandList)
    ?? applyStaticFunctionEvalState(statement, state, runCommandList);

  if (compoundResult) return compoundResult;

  applyStaticVariableState(statement, state, options, undefined, shellFunctions);
  return readCommandStatus(statement, state, shellFunctions);
}

function applyStaticFunctionCommandList(
  command: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  shellFunctions: ShellFunctionDefinitions,
  applyStaticVariableState: ApplyStaticFunctionVariableState,
  readCommandStatus: ReadStaticFunctionCommandExecutionStatus,
): StaticFunctionCommandListResult {
  return applyStaticFunctionCommandListState(command, (bodyStatement) => {
    const substituted = substituteStaticShellVariables(bodyStatement, state.values, state.unsetNames);
    const expanded = isStaticShellControlStatement(bodyStatement)
      ? substituted
      : withExportedStaticEnvCommand(substituted, state);
    return applyStaticFunctionStatementState(
      expanded,
      state,
      options,
      shellFunctions,
      applyStaticVariableState,
      readCommandStatus,
    );
  }, state.shellOptions);
}
