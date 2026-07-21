import { matchingStaticCaseBranch, shellCaseStatement } from './shell-case-parser.utils';
import { shellIfStatement } from './shell-if-parser.utils';
import type { StaticVariableState } from './shell-static-assignment.types';
import { withStaticErrexitSuppressed } from './shell-static-errexit-suppression.utils';
import type { StaticFunctionCommandListResult } from './shell-static-function-command-list-assignment.utils';
import type { RunStaticFunctionCommandList } from './shell-static-function-statement.types';
import { staticShellWordValue, substituteStaticShellVariables } from './shell-static-variable-command.utils';

export function applyStaticFunctionIfState(
  statement: string,
  state: StaticVariableState,
  runCommandList: RunStaticFunctionCommandList,
): StaticFunctionCommandListResult | null {
  const ifCommand = shellIfStatement(statement);
  if (!ifCommand) return null;

  const condition = substituteStaticShellVariables(ifCommand.condition, state.values, state.unsetNames);
  const conditionResult = withStaticErrexitSuppressed(state, () => runCommandList(condition, state));
  if (conditionResult.returned) return conditionResult;
  if (conditionResult.status === null) return functionResult(null);

  const body = conditionResult.status ? ifCommand.thenBody : ifCommand.elseBody;
  return body ? runCommandList(body, state) : functionResult(true);
}

export function applyStaticFunctionCaseState(
  statement: string,
  state: StaticVariableState,
  runCommandList: RunStaticFunctionCommandList,
): StaticFunctionCommandListResult | null {
  const caseCommand = shellCaseStatement(statement);
  if (!caseCommand) return null;

  const subject = staticShellWordValue(substituteStaticShellVariables(caseCommand.subject, state.values, state.unsetNames));
  if (subject === null) return functionResult(null);

  const branch = matchingStaticCaseBranch(caseCommand, subject);
  if (branch === null) return functionResult(null);
  if (!branch) return functionResult(true);

  return runCommandList(branch.body, state);
}

function functionResult(status: StaticFunctionCommandListResult['status']): StaticFunctionCommandListResult {
  return { status, returned: false };
}
