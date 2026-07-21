import { splitStaticAssignmentCommandStatements } from './shell-static-assignment-statement.utils';
import type {
  StaticShellCommandExecutionStatus,
  StaticShellCommandStatus,
  StaticShellCommandStatusOptions,
} from './shell-static-command-status.types';
import { staticErrexitStopsCommandList } from './shell-static-errexit-command.utils';

export type StaticCommandListStatementResult = StaticShellCommandStatus | StaticShellCommandExecutionStatus;

export type ApplyStaticCommandListStatement = (statement: string) => StaticCommandListStatementResult;

export function applyStaticCommandListState(
  command: string,
  applyStatement: ApplyStaticCommandListStatement,
  options: StaticShellCommandStatusOptions = {},
): StaticShellCommandStatus {
  const statements = splitStaticAssignmentCommandStatements(command);
  let previousStatus: StaticShellCommandStatus = null;
  let exited = false;
  let executed = false;

  for (let index = 0; index < statements.length; index += 1) {
    const { statement, operatorBefore } = statements[index];
    const nextOperator = statements[index + 1]?.operatorBefore ?? null;
    if (exited) continue;
    if (!shouldApplyStaticStatement(operatorBefore, previousStatus)) continue;
    executed = true;
    const result = applyStatement(statement);
    previousStatus = staticCommandListResultStatus(result);
    exited = staticErrexitStopsCommandList(
      previousStatus,
      options,
      nextOperator,
      staticCommandListResultExitsOnErrexit(result),
    );
  }

  return executed ? previousStatus : true;
}

export function shouldApplyStaticStatement(
  operatorBefore: string | null,
  previousStatus: StaticShellCommandStatus,
): boolean {
  if (operatorBefore === '&&') return previousStatus === true;
  if (operatorBefore === '||') return previousStatus === false;
  return true;
}

export function staticCommandListResultStatus(result: StaticCommandListStatementResult): StaticShellCommandStatus {
  return result !== null && typeof result === 'object' ? result.status : result;
}

export function staticCommandListResultExitsOnErrexit(result: StaticCommandListStatementResult): boolean {
  return result !== null && typeof result === 'object'
    ? result.exitsOnErrexit ?? true
    : true;
}
