import { evalCommandInvocation, evalCommandString } from './eval-command-string.utils';
import { matchingStaticCaseBranch, shellCaseStatement } from './shell-case-parser.utils';
import { getShellTokenBasename, normalizeShellWordToken, splitShellWords } from './shell-command.utils';
import { staticForLoopStatement } from './shell-for-loop-parser.utils';
import { expandShellFunctionCommand } from './shell-function-command.utils';
import { unwrapShellGroupCommand } from './shell-group-command.utils';
import { shellIfStatement, staticShellIfConditionResult } from './shell-if-parser.utils';
import { staticShellCommandListStatus } from './shell-static-command-list-status.utils';
import { staticShellFunctionCommandListStatus } from './shell-static-function-command-list-status.utils';
import { staticShellForLoopValues } from './shell-static-for-loop-values.utils';
import type {
  StaticShellCommandStatus,
  StaticShellCommandStatusOptions,
  StaticShellCommandStatusResolver,
} from './shell-static-command-status.types';
import { staticShellPipelineCommandStatus } from './shell-static-pipeline-status.utils';
import { staticShellWhileUntilLoopStatus } from './shell-static-while-until-status.utils';
import { staticShellWordValue, substituteStaticShellVariables } from './shell-static-variable-command.utils';

export function staticShellStructuredCommandStatus(
  statement: string,
  tokens: string[],
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions = {},
): StaticShellCommandStatus {
  const ifStatus = staticShellIfCommandStatus(statement, resolveStatus, options);
  if (ifStatus !== null) return ifStatus;

  const caseStatus = staticShellCaseCommandStatus(statement, resolveStatus, options);
  if (caseStatus !== null) return caseStatus;

  const forStatus = staticShellForLoopCommandStatus(statement, resolveStatus, options);
  if (forStatus !== null) return forStatus;

  const whileUntilStatus = staticShellWhileUntilLoopStatus(statement, resolveStatus, options);
  if (whileUntilStatus !== null) return whileUntilStatus;

  const groupStatus = staticShellGroupCommandStatus(statement, resolveStatus, options);
  if (groupStatus !== null) return groupStatus;

  const evalStatus = staticShellEvalCommandStatus(tokens, resolveStatus, options);
  if (evalStatus !== null) return evalStatus;

  const pipelineStatus = staticShellPipelineCommandStatus(statement, resolveStatus, options);
  if (pipelineStatus !== null) return pipelineStatus;

  return staticShellCommandWrapperStatus(tokens, resolveStatus, options);
}

export function staticShellFunctionInvocationStatus(
  invocation: string,
  body: string,
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions = {},
): StaticShellCommandStatus {
  return staticShellFunctionCommandListStatus(
    expandShellFunctionCommand(invocation, body),
    resolveStatus,
    options,
  );
}

function staticShellIfCommandStatus(
  statement: string,
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions,
): StaticShellCommandStatus {
  const ifCommand = shellIfStatement(statement);
  if (!ifCommand) return null;

  const conditionResult = staticShellIfConditionResult(ifCommand.condition);
  if (conditionResult === null) return null;

  return staticShellCommandListStatus(
    conditionResult ? ifCommand.thenBody : ifCommand.elseBody,
    resolveStatus,
    options,
  );
}

function staticShellCaseCommandStatus(
  statement: string,
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions,
): StaticShellCommandStatus {
  const caseCommand = shellCaseStatement(statement);
  if (!caseCommand) return null;

  const subject = staticShellWordValue(caseCommand.subject);
  if (subject === null) return null;

  const branch = matchingStaticCaseBranch(caseCommand, subject);
  if (branch === null) return null;
  if (!branch) return true;

  return staticShellCommandListStatus(branch.body, resolveStatus, options);
}

function staticShellForLoopCommandStatus(
  statement: string,
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions,
): StaticShellCommandStatus {
  const loop = staticForLoopStatement(statement);
  if (!loop) return null;

  const values = staticShellForLoopValues(loop.valuesText);
  if (values === null) return null;
  if (values.length === 0) return true;

  const finalValue = values.at(-1);
  if (finalValue === undefined) return true;

  const finalBody = substituteStaticShellVariables(
    loop.body,
    new Map([[loop.variableName, finalValue]]),
  );
  return staticShellCommandListStatus(finalBody, resolveStatus, options);
}

function staticShellGroupCommandStatus(
  statement: string,
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions,
): StaticShellCommandStatus {
  const body = unwrapShellGroupCommand(statement, { stripTrailingTerminator: true });
  if (body === statement) return null;
  return staticShellCommandListStatus(body, resolveStatus, options);
}

function staticShellEvalCommandStatus(
  tokens: string[],
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions,
): StaticShellCommandStatus {
  const invocation = evalCommandInvocation(tokens);
  const command = evalCommandString(tokens);
  if (!command && !invocation && getShellTokenBasename(tokens[0] ?? '') !== 'eval') return null;
  return command ? staticShellCommandListStatus(command, resolveStatus, options) : true;
}

function staticShellCommandWrapperStatus(
  tokens: string[],
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions,
): StaticShellCommandStatus {
  const wrapper = getShellTokenBasename(tokens[0] ?? '');
  if (wrapper === 'builtin') {
    if (tokens.length === 1) return true;
    return normalizeShellWordToken(tokens[1]).startsWith('-')
      ? null
      : resolveStatus(tokens.slice(1).join(' '), options);
  }
  if (wrapper !== 'command') return null;

  let commandIndex = 1;
  for (; commandIndex < tokens.length; commandIndex += 1) {
    const option = normalizeShellWordToken(tokens[commandIndex]);
    if (option === '--') {
      commandIndex += 1;
      break;
    }
    if (!option.startsWith('-')) break;
    if (option === '-p') continue;
    return null;
  }

  return commandIndex >= tokens.length
    ? true
    : resolveStatus(tokens.slice(commandIndex).join(' '), options);
}
