import type { ShellFunctionDefinitions } from './shell-function-command.utils';
import { shellBraceGroupBody } from './shell-brace-group-command.utils';
import type { StaticAssignmentCommandOptions, StaticVariableState } from './shell-static-assignment.types';
import { applyStaticCommandListState } from './shell-static-command-list-assignment.utils';
import { staticFunctionAwareCommandExecutionStatus } from './shell-static-function-invocation-assignment.utils';
import { substituteStaticShellVariables } from './shell-static-variable-command.utils';

type ApplyStaticVariableState = (
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  evalDepth?: number,
  shellFunctions?: ShellFunctionDefinitions,
) => void;

export function applyStaticBraceGroupState(
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  applyStaticVariableState: ApplyStaticVariableState,
  shellFunctions?: ShellFunctionDefinitions,
): boolean {
  const body = shellBraceGroupBody(statement);
  if (body === null) return false;

  applyStaticCommandListState(body, (bodyStatement) => {
    const expanded = substituteStaticShellVariables(bodyStatement, state.values, state.unsetNames);
    applyStaticVariableState(expanded, state, options, undefined, shellFunctions);
    return staticFunctionAwareCommandExecutionStatus(expanded, state, shellFunctions);
  }, state.shellOptions);

  return true;
}
