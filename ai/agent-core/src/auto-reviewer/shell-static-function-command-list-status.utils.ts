import { matchingStaticCaseBranch, shellCaseStatement } from './shell-case-parser.utils';
import { staticForLoopStatement } from './shell-for-loop-parser.utils';
import { shellIfStatement } from './shell-if-parser.utils';
import { staticLoopControlCommand, type ShellLoopControlCommand } from './shell-loop-control-command.utils';
import { shellWhileUntilLoopStatement } from './shell-while-until-loop-parser.utils';
import { splitStaticAssignmentCommandStatements } from './shell-static-assignment-statement.utils';
import { shouldApplyStaticStatement } from './shell-static-command-list-assignment.utils';
import {
  type StaticShellCommandStatus,
  type StaticShellCommandStatusOptions,
  type StaticShellCommandStatusResolver,
} from './shell-static-command-status.types';
import { staticFunctionReturnCommand } from './shell-function-return-command.utils';
import { staticShellForLoopValues } from './shell-static-for-loop-values.utils';
import {
  staticShellFunctionEvalStatus,
  staticShellFunctionGroupStatus,
} from './shell-static-function-compound-status.utils';
import type { StaticShellFunctionStatusResult } from './shell-static-function-command-list-status.types';
import { applyStaticShellOptionState, cloneStaticShellCommandStatusOptions } from './shell-static-option-command.utils';
import { staticShellWordValue, substituteStaticShellVariables } from './shell-static-variable-command.utils';

interface StaticShellFunctionLoopStatusResult extends StaticShellFunctionStatusResult {
  control: ShellLoopControlCommand | null;
}

export function staticShellFunctionCommandListStatus(
  command: string,
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions = {},
): StaticShellCommandStatus {
  return staticShellFunctionCommandListStatusResult(command, resolveStatus, options).status;
}

function staticShellFunctionCommandListStatusResult(
  command: string,
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions = {},
): StaticShellFunctionStatusResult {
  const statements = splitStaticAssignmentCommandStatements(command);
  const activeOptions = cloneStaticShellCommandStatusOptions(options);
  let previousStatus: StaticShellCommandStatus = null;
  let executed = false;

  for (const { statement, operatorBefore } of statements) {
    if (!shouldApplyStaticStatement(operatorBefore, previousStatus)) continue;

    executed = true;
    const returnCommand = staticFunctionReturnCommand(statement, previousStatus);
    if (returnCommand) return { status: returnCommand.status, returned: true };

    const result = staticShellFunctionStatementStatus(statement, resolveStatus, activeOptions);
    previousStatus = result.status;
    applyStaticShellOptionState(statement, activeOptions);
    if (result.returned) return result;
  }

  return { status: executed ? previousStatus : true, returned: false };
}

function staticShellFunctionStatementStatus(
  statement: string,
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions,
): StaticShellFunctionStatusResult {
  return staticShellFunctionIfStatus(statement, resolveStatus, options)
    ?? staticShellFunctionCaseStatus(statement, resolveStatus, options)
    ?? staticShellFunctionForLoopStatus(statement, resolveStatus, options)
    ?? staticShellFunctionWhileUntilStatus(statement, resolveStatus, options)
    ?? staticShellFunctionGroupStatus(statement, (command) => staticShellFunctionCommandListStatusResult(command, resolveStatus, options))
    ?? staticShellFunctionEvalStatus(statement, (command) => staticShellFunctionCommandListStatusResult(command, resolveStatus, options))
    ?? { status: resolveStatus(statement, options), returned: false };
}

function staticShellFunctionIfStatus(
  statement: string,
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions,
): StaticShellFunctionStatusResult | null {
  const ifCommand = shellIfStatement(statement);
  if (!ifCommand) return null;

  const conditionOptions = cloneStaticShellCommandStatusOptions(options);
  conditionOptions.errexitSuppressed = true;
  const conditionResult = staticShellFunctionCommandListStatusResult(
    ifCommand.condition,
    resolveStatus,
    conditionOptions,
  );
  if (conditionResult.returned) return conditionResult;
  if (conditionResult.status === null) return functionResult(null);

  const body = conditionResult.status ? ifCommand.thenBody : ifCommand.elseBody;
  return body
    ? staticShellFunctionCommandListStatusResult(body, resolveStatus, options)
    : functionResult(true);
}

function staticShellFunctionCaseStatus(
  statement: string,
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions,
): StaticShellFunctionStatusResult | null {
  const caseCommand = shellCaseStatement(statement);
  if (!caseCommand) return null;

  const subject = staticShellWordValue(caseCommand.subject);
  if (subject === null) return functionResult(null);

  const branch = matchingStaticCaseBranch(caseCommand, subject);
  if (branch === null) return functionResult(null);
  if (!branch) return functionResult(true);

  return staticShellFunctionCommandListStatusResult(branch.body, resolveStatus, options);
}

function staticShellFunctionForLoopStatus(
  statement: string,
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions,
): StaticShellFunctionStatusResult | null {
  const loop = staticForLoopStatement(statement);
  if (!loop) return null;

  const values = staticShellForLoopValues(loop.valuesText);
  if (values === null) return functionResult(null);
  if (values.length === 0) return functionResult(true);

  let result = functionResult(true);
  for (const value of values) {
    const body = substituteStaticShellVariables(loop.body, new Map([[loop.variableName, value]]));
    const loopResult = staticShellFunctionLoopStatus(body, resolveStatus, options);
    result = { status: loopResult.status, returned: loopResult.returned };
    if (loopResult.returned) return result;
    if (loopResult.control === 'break') break;
  }

  return result;
}

function staticShellFunctionWhileUntilStatus(
  statement: string,
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions,
): StaticShellFunctionStatusResult | null {
  const loop = shellWhileUntilLoopStatement(statement);
  if (!loop) return null;

  const conditionOptions = cloneStaticShellCommandStatusOptions(options);
  conditionOptions.errexitSuppressed = true;
  const conditionResult = staticShellFunctionCommandListStatusResult(
    loop.condition,
    resolveStatus,
    conditionOptions,
  );
  if (conditionResult.returned) return conditionResult;
  if (loop.kind === 'while' && conditionResult.status === false) return functionResult(true);
  if (loop.kind === 'until' && conditionResult.status === true) return functionResult(true);

  const entersBody = loop.kind === 'while' ? conditionResult.status === true : conditionResult.status === false;
  if (!entersBody) return functionResult(null);

  const bodyResult = staticShellFunctionLoopStatus(loop.body, resolveStatus, options);
  if (bodyResult.returned) return { status: bodyResult.status, returned: true };
  return bodyResult.control === 'break' ? functionResult(true) : functionResult(null);
}

function staticShellFunctionLoopStatus(
  body: string,
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions,
): StaticShellFunctionLoopStatusResult {
  const statements = splitStaticAssignmentCommandStatements(body);
  let previousStatus: StaticShellCommandStatus = null;

  for (const { statement, operatorBefore } of statements) {
    if (!shouldApplyStaticStatement(operatorBefore, previousStatus)) continue;

    const control = staticLoopControlCommand(statement);
    if (control) return { status: true, returned: false, control };

    const returnCommand = staticFunctionReturnCommand(statement, previousStatus);
    if (returnCommand) return { status: returnCommand.status, returned: true, control: null };

    const result = staticShellFunctionStatementStatus(statement, resolveStatus, options);
    previousStatus = result.status;
    if (result.returned) return { status: result.status, returned: true, control: null };
  }

  return { status: previousStatus, returned: false, control: null };
}

function functionResult(status: StaticShellCommandStatus): StaticShellFunctionStatusResult {
  return { status, returned: false };
}
