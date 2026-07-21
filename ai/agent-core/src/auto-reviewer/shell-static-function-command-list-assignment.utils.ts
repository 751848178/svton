import { staticFunctionReturnCommand } from './shell-function-return-command.utils';
import { splitStaticAssignmentCommandStatements } from './shell-static-assignment-statement.utils';
import type { StaticShellCommandStatus, StaticShellCommandStatusOptions } from './shell-static-command-status.types';
import { staticErrexitStopsCommandList } from './shell-static-errexit-command.utils';
import {
  shouldApplyStaticStatement,
  staticCommandListResultExitsOnErrexit,
  staticCommandListResultStatus,
  type StaticCommandListStatementResult,
} from './shell-static-command-list-assignment.utils';

export interface StaticFunctionCommandListResult {
  status: StaticShellCommandStatus;
  returned: boolean;
}

export type StaticFunctionCommandListStatementResult =
  | StaticCommandListStatementResult
  | StaticFunctionCommandListResult;

type ApplyStaticFunctionCommandListStatement = (
  statement: string,
) => StaticFunctionCommandListStatementResult;

export function applyStaticFunctionCommandListState(
  command: string,
  applyStatement: ApplyStaticFunctionCommandListStatement,
  options: StaticShellCommandStatusOptions = {},
): StaticFunctionCommandListResult {
  const statements = splitStaticAssignmentCommandStatements(command);
  let previousStatus: StaticShellCommandStatus = null;
  let executed = false;

  for (let index = 0; index < statements.length; index += 1) {
    const { statement, operatorBefore } = statements[index];
    if (!shouldApplyStaticStatement(operatorBefore, previousStatus)) continue;

    executed = true;
    const returnCommand = staticFunctionReturnCommand(statement, previousStatus);
    if (returnCommand) return { status: returnCommand.status, returned: true };

    const result = applyStatement(statement);
    previousStatus = staticCommandListResultStatus(result);
    if (staticFunctionCommandListResultReturned(result)) {
      return { status: previousStatus, returned: true };
    }
    const nextOperator = statements[index + 1]?.operatorBefore ?? null;
    if (staticErrexitStopsCommandList(
      previousStatus,
      options,
      nextOperator,
      staticCommandListResultExitsOnErrexit(result),
    )) break;
  }

  return { status: executed ? previousStatus : true, returned: false };
}

export function staticFunctionCommandListResultReturned(
  result: StaticFunctionCommandListStatementResult,
): boolean {
  return result !== null && typeof result === 'object' && 'returned' in result && result.returned;
}
