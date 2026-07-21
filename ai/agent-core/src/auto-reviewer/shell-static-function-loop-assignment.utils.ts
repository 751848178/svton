import { staticForLoopStatement } from './shell-for-loop-parser.utils';
import { shellWhileUntilLoopStatement } from './shell-while-until-loop-parser.utils';
import type { StaticVariableState } from './shell-static-assignment.types';
import { cloneStaticVariableState, commitStaticVariableState } from './shell-static-assignment-state.utils';
import type { StaticShellCommandStatus } from './shell-static-command-status.types';
import { withStaticErrexitSuppressed } from './shell-static-errexit-suppression.utils';
import { staticShellForLoopValues } from './shell-static-for-loop-values.utils';
import type { StaticFunctionCommandListResult } from './shell-static-function-command-list-assignment.utils';
import { applyStaticFunctionLoopCommandListState } from './shell-static-function-loop-command-list-assignment.utils';
import type {
  ApplyStaticFunctionStatementState,
  RunStaticFunctionCommandList,
} from './shell-static-function-statement.types';
import {
  applyStaticLoopVariableValue,
  clearStaticLoopVariable,
} from './shell-static-loop-variable-state.utils';
import { substituteStaticShellVariables } from './shell-static-variable-command.utils';

export function applyStaticFunctionForLoopState(
  statement: string,
  state: StaticVariableState,
  applyStatement: ApplyStaticFunctionStatementState,
): StaticFunctionCommandListResult | null {
  const loop = staticForLoopStatement(statement);
  if (!loop) return null;

  const values = staticShellForLoopValues(substituteStaticShellVariables(loop.valuesText, state.values, state.unsetNames));
  if (values === null) {
    clearStaticLoopVariable(loop.variableName, state);
    return functionResult(true);
  }
  if (values.length === 0) return functionResult(true);

  let status: StaticShellCommandStatus = true;
  for (const value of values) {
    applyStaticLoopVariableValue(loop.variableName, value, state);
    const result = applyStaticFunctionLoopCommandListState(loop.body, (bodyStatement) => {
      const expanded = substituteStaticShellVariables(bodyStatement, state.values, state.unsetNames);
      return applyStatement(expanded, state);
    }, state.shellOptions);
    status = result.status;
    if (result.returned) return { status, returned: true };
    if (result.control === 'break') break;
  }

  return functionResult(status);
}

export function applyStaticFunctionWhileUntilState(
  statement: string,
  state: StaticVariableState,
  applyStatement: ApplyStaticFunctionStatementState,
  runCommandList: RunStaticFunctionCommandList,
): StaticFunctionCommandListResult | null {
  const loop = shellWhileUntilLoopStatement(statement);
  if (!loop) return null;

  const conditionState = cloneStaticVariableState(state);
  const conditionResult = withStaticErrexitSuppressed(
    conditionState,
    () => runCommandList(loop.condition, conditionState),
  );
  if (conditionResult.returned) {
    commitStaticVariableState(state, conditionState);
    return conditionResult;
  }

  const skipsBody = loop.kind === 'while' ? conditionResult.status === false : conditionResult.status === true;
  if (skipsBody) {
    commitStaticVariableState(state, conditionState);
    return functionResult(true);
  }

  const entersBody = loop.kind === 'while' ? conditionResult.status === true : conditionResult.status === false;
  if (!entersBody) return functionResult(null);

  const bodyResult = applyStaticFunctionLoopCommandListState(loop.body, (bodyStatement) => {
    const expanded = substituteStaticShellVariables(bodyStatement, conditionState.values, conditionState.unsetNames);
    return applyStatement(expanded, conditionState);
  }, conditionState.shellOptions);

  if (bodyResult.returned) {
    commitStaticVariableState(state, conditionState);
    return { status: bodyResult.status, returned: true };
  }
  if (bodyResult.control === 'break') {
    commitStaticVariableState(state, conditionState);
    return functionResult(true);
  }

  return functionResult(null);
}

function functionResult(status: StaticFunctionCommandListResult['status']): StaticFunctionCommandListResult {
  return { status, returned: false };
}
