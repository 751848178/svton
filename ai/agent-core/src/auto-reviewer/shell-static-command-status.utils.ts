import { getShellTokenBasename, normalizeShellWordToken, splitShellWords } from './shell-command.utils';
import {
  applyShellCommandNegationStatus,
  shellCommandNegation,
} from './shell-command-negation.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';
import { staticShellIfConditionResult } from './shell-if-parser.utils';
import type {
  StaticShellCommandStatus,
  StaticShellCommandStatusOptions,
} from './shell-static-command-status.types';
import {
  staticShellFunctionInvocationStatus,
  staticShellStructuredCommandStatus,
} from './shell-static-structured-command-status.utils';
import { staticShellOptionCommandStatus } from './shell-static-option-command.utils';

export type { StaticShellCommandStatus } from './shell-static-command-status.types';

const SUCCESS_DECLARATION_COMMANDS = new Set(['declare', 'export', 'local', 'readonly', 'typeset']);
const SUCCESS_BUILTINS = new Set([':', 'true', 'unset']);

export function staticShellCommandStatus(
  statement: string,
  options: StaticShellCommandStatusOptions = {},
): StaticShellCommandStatus {
  const tokens = splitCommandStatusWords(statement);
  if (tokens.length === 0) return true;

  const negation = shellCommandNegation(tokens);
  if (negation.count > 0) {
    const status = staticShellCommandStatus(negation.tokens.join(' '), options);
    return applyShellCommandNegationStatus(status, negation.count);
  }

  const structuredStatus = staticShellStructuredCommandStatus(
    statement,
    tokens,
    (nextStatement, nextOptions = options) => staticShellCommandStatus(nextStatement, nextOptions),
    options,
  );
  if (structuredStatus !== null) return structuredStatus;

  const assignmentPrefixedStatus = staticAssignmentPrefixedCommandStatus(tokens, options);
  if (assignmentPrefixedStatus !== null) return assignmentPrefixedStatus;

  if (tokens.length === 1 && isAssignmentToken(tokens[0])) return true;

  const command = getShellTokenBasename(tokens[0] ?? '');
  if (SUCCESS_BUILTINS.has(command)) return true;
  if (command === 'false') return false;
  if (SUCCESS_DECLARATION_COMMANDS.has(command)) return true;
  const optionStatus = staticShellOptionCommandStatus(tokens);
  if (optionStatus !== null) return optionStatus;

  return staticShellIfConditionResult(
    tokens.map(normalizeShellWordToken).join(' '),
  );
}

export function staticShellFunctionCommandStatus(
  invocation: string,
  body: string,
  options: StaticShellCommandStatusOptions = {},
): StaticShellCommandStatus {
  return staticShellFunctionInvocationStatus(
    invocation,
    body,
    (nextStatement, nextOptions = options) => staticShellCommandStatus(nextStatement, nextOptions),
    options,
  );
}

function staticAssignmentPrefixedCommandStatus(
  tokens: string[],
  options: StaticShellCommandStatusOptions,
): StaticShellCommandStatus {
  if (!isAssignmentToken(tokens[0] ?? '')) return null;

  const commandIndex = tokens.findIndex((token) => !isAssignmentToken(token));
  return commandIndex < 0
    ? true
    : staticShellCommandStatus(tokens.slice(commandIndex).join(' '), options);
}

function splitCommandStatusWords(statement: string): string[] {
  const tokens = splitShellWords(statement);
  const commandIndex = tokens.findIndex((token) => !isAssignmentToken(token));
  if (commandIndex < 0) return tokens;

  return [
    ...tokens.slice(0, commandIndex),
    ...splitUnquotedIfsExpansionTokens(tokens.slice(commandIndex)),
  ];
}

function isAssignmentToken(token: string): boolean {
  const separator = token.indexOf('=');
  if (separator <= 0) return false;
  return /^[A-Za-z_]\w*$/.test(token.slice(0, separator));
}
