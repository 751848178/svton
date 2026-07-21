import { matchingStaticCaseBranch, shellCaseStatement } from './shell-case-parser.utils';
import { splitShellWords } from './shell-command.utils';
import { staticForLoopStatement } from './shell-for-loop-parser.utils';
import { unwrapShellGroupCommand } from './shell-group-command.utils';
import {
  shellIfStatement,
  staticShellIfConditionResult,
} from './shell-if-parser.utils';
import { splitStaticAssignmentCommandStatements } from './shell-static-assignment-statement.utils';
import type {
  StaticShellCommandExecutionStatus,
  StaticShellCommandStatus,
  StaticShellCommandStatusOptions,
  StaticShellCommandStatusResolver,
} from './shell-static-command-status.types';
import {
  applyStaticShellOptionState,
  cloneStaticShellCommandStatusOptions,
} from './shell-static-option-command.utils';
import { staticShellWordValue, substituteStaticShellVariables } from './shell-static-variable-command.utils';

export function staticErrexitStopsCommandList(
  status: StaticShellCommandStatus,
  options: StaticShellCommandStatusOptions,
  nextOperator: string | null,
  exitsOnErrexit = true,
): boolean {
  return options.errexit === true
    && options.errexitSuppressed !== true
    && status === false
    && exitsOnErrexit
    && nextOperator !== '&&'
    && nextOperator !== '||';
}

export function staticShellCommandExitsOnErrexit(
  statement: string,
  status: StaticShellCommandStatus,
  options: StaticShellCommandStatusOptions,
  resolveStatus: StaticShellCommandStatusResolver,
): boolean {
  if (options.errexit !== true || status !== false) return false;
  return staticShellCommandErrexitExecutionStatus(statement, options, resolveStatus)?.exitsOnErrexit ?? true;
}

export function staticShellCommandErrexitExecutionStatus(
  statement: string,
  options: StaticShellCommandStatusOptions,
  resolveStatus: StaticShellCommandStatusResolver,
): StaticShellCommandExecutionStatus | null {
  const groupBody = unwrapShellGroupCommand(statement, { stripTrailingTerminator: true });
  if (groupBody !== statement) return staticShellCommandListErrexitStatus(groupBody, options, resolveStatus);

  const ifBody = staticShellIfErrexitBody(statement);
  if (ifBody !== null) return staticShellCommandListErrexitStatus(ifBody, options, resolveStatus);

  const caseStatus = staticShellCaseErrexitStatus(statement, options, resolveStatus);
  if (caseStatus !== null) return caseStatus;

  return staticShellForErrexitStatus(statement, options, resolveStatus);
}

function staticShellCommandListErrexitStatus(
  command: string,
  options: StaticShellCommandStatusOptions,
  resolveStatus: StaticShellCommandStatusResolver,
): StaticShellCommandExecutionStatus {
  const statements = splitStaticAssignmentCommandStatements(command);
  const activeOptions = cloneStaticShellCommandStatusOptions(options);
  let previousStatus: StaticShellCommandStatus = null;
  let executed = false;

  for (let index = 0; index < statements.length; index += 1) {
    const { statement, operatorBefore } = statements[index];
    if (operatorBefore === '&&' && previousStatus !== true) continue;
    if (operatorBefore === '||' && previousStatus !== false) continue;

    executed = true;
    const baseStatus = resolveStatus(statement, activeOptions);
    applyStaticShellOptionState(statement, activeOptions);
    const commandStatus = staticShellCommandErrexitExecutionStatus(
      statement,
      activeOptions,
      resolveStatus,
    ) ?? {
      status: baseStatus,
      exitsOnErrexit: activeOptions.errexit === true && baseStatus === false,
    };
    const nextOperator = statements[index + 1]?.operatorBefore ?? null;
    if (
      staticErrexitStopsCommandList(
        commandStatus.status,
        activeOptions,
        nextOperator,
        commandStatus.exitsOnErrexit,
      )
    ) {
      return { status: commandStatus.status, exitsOnErrexit: true };
    }
    previousStatus = commandStatus.status;
  }

  return { status: executed ? previousStatus : true, exitsOnErrexit: false };
}

function staticShellIfErrexitBody(statement: string): string | null {
  const ifCommand = shellIfStatement(statement);
  if (!ifCommand) return null;

  const conditionResult = staticShellIfConditionResult(ifCommand.condition);
  if (conditionResult === null) return null;
  return conditionResult ? ifCommand.thenBody : ifCommand.elseBody;
}

function staticShellCaseErrexitStatus(
  statement: string,
  options: StaticShellCommandStatusOptions,
  resolveStatus: StaticShellCommandStatusResolver,
): StaticShellCommandExecutionStatus | null {
  const caseCommand = shellCaseStatement(statement);
  if (!caseCommand) return null;

  const subject = staticShellWordValue(caseCommand.subject);
  if (subject === null) return null;

  const branch = matchingStaticCaseBranch(caseCommand, subject);
  return branch
    ? staticShellCommandListErrexitStatus(branch.body, options, resolveStatus)
    : { status: true, exitsOnErrexit: false };
}

function staticShellForErrexitStatus(
  statement: string,
  options: StaticShellCommandStatusOptions,
  resolveStatus: StaticShellCommandStatusResolver,
): StaticShellCommandExecutionStatus | null {
  const loop = staticForLoopStatement(statement);
  if (!loop) return null;

  let finalStatus: StaticShellCommandStatus = true;
  let executed = false;
  for (const valueToken of splitShellWords(loop.valuesText)) {
    const value = staticShellWordValue(valueToken);
    if (value === null) return null;
    executed = true;
    const body = substituteStaticShellVariables(loop.body, new Map([[loop.variableName, value]]));
    const bodyStatus = staticShellCommandListErrexitStatus(body, options, resolveStatus);
    if (bodyStatus.exitsOnErrexit) return bodyStatus;
    finalStatus = bodyStatus.status;
  }

  return { status: executed ? finalStatus : true, exitsOnErrexit: false };
}
