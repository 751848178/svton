import { evalCommandInvocation, evalCommandString } from './eval-command-string.utils';
import { getShellTokenBasename, splitShellWords } from './shell-command.utils';
import { shellBraceGroupBody } from './shell-brace-group-command.utils';
import type { StaticShellCommandStatus } from './shell-static-command-status.types';
import type {
  RunStaticShellFunctionStatusCommandList,
  StaticShellFunctionStatusResult,
} from './shell-static-function-command-list-status.types';

export function staticShellFunctionGroupStatus(
  statement: string,
  runCommandList: RunStaticShellFunctionStatusCommandList,
): StaticShellFunctionStatusResult | null {
  const body = shellBraceGroupBody(statement);
  if (body === null) return null;
  return body ? runCommandList(body) : functionResult(true);
}

export function staticShellFunctionEvalStatus(
  statement: string,
  runCommandList: RunStaticShellFunctionStatusCommandList,
): StaticShellFunctionStatusResult | null {
  const tokens = splitShellWords(statement);
  const invocation = evalCommandInvocation(tokens);
  const command = evalCommandString(tokens);
  if (!command && !invocation && getShellTokenBasename(tokens[0] ?? '') !== 'eval') return null;
  return command ? runCommandList(command) : functionResult(true);
}

function functionResult(status: StaticShellCommandStatus): StaticShellFunctionStatusResult {
  return { status, returned: false };
}
