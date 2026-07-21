import type { ShellFunctionDefinitions } from './shell-function-command.utils';
import { shellWhileUntilLoopStatement } from './shell-while-until-loop-parser.utils';
import type { StaticAssignmentCommandOptions, StaticVariableState } from './shell-static-assignment.types';
import {
  cloneStaticVariableState,
  commitStaticVariableState,
} from './shell-static-assignment-state.utils';
import { applyStaticCommandListState } from './shell-static-command-list-assignment.utils';
import { withStaticErrexitSuppressed } from './shell-static-errexit-suppression.utils';
import { staticFunctionAwareCommandExecutionStatus } from './shell-static-function-invocation-assignment.utils';
import { applyStaticLoopCommandListState } from './shell-static-loop-command-list-assignment.utils';
import { substituteStaticShellVariables } from './shell-static-variable-command.utils';

type ApplyStaticVariableState = (
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  evalDepth?: number,
  shellFunctions?: ShellFunctionDefinitions,
) => void;

export function applyStaticWhileUntilState(
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  applyStaticVariableState: ApplyStaticVariableState,
  shellFunctions?: ShellFunctionDefinitions,
): boolean {
  const loop = shellWhileUntilLoopStatement(statement);
  if (!loop) return false;

  const conditionState = cloneStaticVariableState(state);
  const conditionStatus = withStaticErrexitSuppressed(conditionState, () => applyStaticCommandListState(
    loop.condition,
    (conditionStatement) => {
      const expanded = substituteStaticShellVariables(conditionStatement, conditionState.values, conditionState.unsetNames);
      applyStaticVariableState(expanded, conditionState, options, undefined, shellFunctions);
      return staticFunctionAwareCommandExecutionStatus(expanded, conditionState, shellFunctions);
    },
    conditionState.shellOptions,
  ));
  const skipsBody = loop.kind === 'while' ? conditionStatus === false : conditionStatus === true;
  if (skipsBody) {
    commitStaticVariableState(state, conditionState);
    return true;
  }

  const entersBody = loop.kind === 'while' ? conditionStatus === true : conditionStatus === false;
  if (!entersBody) return false;

  const bodyResult = applyStaticLoopCommandListState(loop.body, (bodyStatement) => {
    const expanded = substituteStaticShellVariables(bodyStatement, conditionState.values, conditionState.unsetNames);
    applyStaticVariableState(expanded, conditionState, options, undefined, shellFunctions);
    return staticFunctionAwareCommandExecutionStatus(expanded, conditionState, shellFunctions);
  }, conditionState.shellOptions);
  if (bodyResult.control !== 'break') return false;

  commitStaticVariableState(state, conditionState);
  return true;
}
