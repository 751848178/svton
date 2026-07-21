import type { ShellFunctionDefinitions } from './shell-function-command.utils';
import { staticForLoopStatement } from './shell-for-loop-parser.utils';
import type { StaticAssignmentCommandOptions, StaticVariableState } from './shell-static-assignment.types';
import { staticShellForLoopValues } from './shell-static-for-loop-values.utils';
import {
  applyStaticLoopVariableValue,
  clearStaticLoopVariable,
} from './shell-static-loop-variable-state.utils';
import { applyStaticLoopCommandListState } from './shell-static-loop-command-list-assignment.utils';
import { staticFunctionAwareCommandExecutionStatus } from './shell-static-function-invocation-assignment.utils';
import { substituteStaticShellVariables } from './shell-static-variable-command.utils';

type ApplyStaticVariableState = (
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  evalDepth?: number,
  shellFunctions?: ShellFunctionDefinitions,
) => void;

export function applyStaticForLoopState(
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  applyStaticVariableState: ApplyStaticVariableState,
  shellFunctions?: ShellFunctionDefinitions,
): boolean {
  const loop = staticForLoopStatement(statement);
  if (!loop) return false;

  const values = staticShellForLoopValues(substituteStaticShellVariables(loop.valuesText, state.values, state.unsetNames));
  if (values === null) {
    clearStaticLoopVariable(loop.variableName, state);
    return true;
  }
  if (values.length === 0) return true;

  for (const value of values) {
    applyStaticLoopVariableValue(loop.variableName, value, state);
    const result = applyStaticLoopCommandListState(loop.body, (bodyStatement) => {
      const expanded = substituteStaticShellVariables(bodyStatement, state.values, state.unsetNames);
      applyStaticVariableState(expanded, state, options, undefined, shellFunctions);
      return staticFunctionAwareCommandExecutionStatus(expanded, state, shellFunctions);
    }, state.shellOptions);
    if (result.control === 'break') break;
  }

  return true;
}
