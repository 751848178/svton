import { staticLoopControlCommand, type ShellLoopControlCommand } from './shell-loop-control-command.utils';
import { splitStaticAssignmentCommandStatements } from './shell-static-assignment-statement.utils';
import type { StaticShellCommandStatus, StaticShellCommandStatusOptions } from './shell-static-command-status.types';
import { staticErrexitStopsCommandList } from './shell-static-errexit-command.utils';
import {
  type ApplyStaticCommandListStatement,
  shouldApplyStaticStatement,
  staticCommandListResultExitsOnErrexit,
  staticCommandListResultStatus,
} from './shell-static-command-list-assignment.utils';

export interface StaticLoopCommandListResult {
  status: StaticShellCommandStatus;
  control: ShellLoopControlCommand | null;
}

export function applyStaticLoopCommandListState(
  command: string,
  applyStatement: ApplyStaticCommandListStatement,
  options: StaticShellCommandStatusOptions = {},
): StaticLoopCommandListResult {
  const statements = splitStaticAssignmentCommandStatements(command);
  let previousStatus: StaticShellCommandStatus = null;
  let executed = false;

  for (let index = 0; index < statements.length; index += 1) {
    const { statement, operatorBefore } = statements[index];
    if (!shouldApplyStaticStatement(operatorBefore, previousStatus)) continue;

    executed = true;
    const control = staticLoopControlCommand(statement);
    if (control) return { status: true, control };

    const result = applyStatement(statement);
    previousStatus = staticCommandListResultStatus(result);
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

  return { status: executed ? previousStatus : true, control: null };
}
