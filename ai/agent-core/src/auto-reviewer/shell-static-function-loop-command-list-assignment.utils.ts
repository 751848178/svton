import { staticFunctionReturnCommand } from './shell-function-return-command.utils';
import { staticLoopControlCommand, type ShellLoopControlCommand } from './shell-loop-control-command.utils';
import { splitStaticAssignmentCommandStatements } from './shell-static-assignment-statement.utils';
import { staticErrexitStopsCommandList } from './shell-static-errexit-command.utils';
import {
  shouldApplyStaticStatement,
  staticCommandListResultExitsOnErrexit,
  staticCommandListResultStatus,
} from './shell-static-command-list-assignment.utils';
import type { StaticShellCommandStatus, StaticShellCommandStatusOptions } from './shell-static-command-status.types';
import {
  staticFunctionCommandListResultReturned,
  type StaticFunctionCommandListStatementResult,
} from './shell-static-function-command-list-assignment.utils';

export interface StaticFunctionLoopCommandListResult {
  status: StaticShellCommandStatus;
  control: ShellLoopControlCommand | null;
  returned: boolean;
}

type ApplyStaticFunctionLoopCommandListStatement = (
  statement: string,
) => StaticFunctionCommandListStatementResult;

export function applyStaticFunctionLoopCommandListState(
  command: string,
  applyStatement: ApplyStaticFunctionLoopCommandListStatement,
  options: StaticShellCommandStatusOptions = {},
): StaticFunctionLoopCommandListResult {
  const statements = splitStaticAssignmentCommandStatements(command);
  let previousStatus: StaticShellCommandStatus = null;
  let executed = false;

  for (let index = 0; index < statements.length; index += 1) {
    const { statement, operatorBefore } = statements[index];
    if (!shouldApplyStaticStatement(operatorBefore, previousStatus)) continue;

    executed = true;
    const control = staticLoopControlCommand(statement);
    if (control) return { status: true, control, returned: false };

    const returnCommand = staticFunctionReturnCommand(statement, previousStatus);
    if (returnCommand) {
      return { status: returnCommand.status, control: null, returned: true };
    }

    const result = applyStatement(statement);
    previousStatus = staticCommandListResultStatus(result);
    if (staticFunctionCommandListResultReturned(result)) {
      return { status: previousStatus, control: null, returned: true };
    }

    const nextOperator = statements[index + 1]?.operatorBefore ?? null;
    if (
      staticErrexitStopsCommandList(
        previousStatus,
        options,
        nextOperator,
        staticCommandListResultExitsOnErrexit(result),
      )
    ) break;
  }

  return { status: executed ? previousStatus : true, control: null, returned: false };
}
