import { evalCommandInvocation } from './eval-command-string.utils';
import { getShellTokenBasename, splitShellWords } from './shell-command.utils';
import { shellBraceGroupBody } from './shell-brace-group-command.utils';
import type { StaticVariableState } from './shell-static-assignment.types';
import {
  applyStaticEvalAssignmentPrefixes,
  restoredStaticEvalPrefixSnapshots,
  staticEvalCommandMutatedNames,
  staticEvalAssignmentPrefixNames,
} from './shell-static-eval-prefix.utils';
import type { StaticFunctionCommandListResult } from './shell-static-function-command-list-assignment.utils';
import type { RunStaticFunctionCommandList } from './shell-static-function-statement.types';
import {
  restoreStaticVariableNames,
  snapshotStaticVariableNames,
} from './shell-static-name-snapshot.utils';

export function applyStaticFunctionGroupState(
  statement: string,
  state: StaticVariableState,
  runCommandList: RunStaticFunctionCommandList,
): StaticFunctionCommandListResult | null {
  const body = shellBraceGroupBody(statement);
  if (body === null) return null;
  return body ? runCommandList(body, state) : functionResult(true);
}

export function applyStaticFunctionEvalState(
  statement: string,
  state: StaticVariableState,
  runCommandList: RunStaticFunctionCommandList,
): StaticFunctionCommandListResult | null {
  const tokens = splitShellWords(statement);
  const invocation = evalCommandInvocation(tokens);
  if (!invocation && getShellTokenBasename(tokens[0] ?? '') !== 'eval') return null;
  if (!invocation?.command) return functionResult(true);

  const prefixNames = staticEvalAssignmentPrefixNames(invocation.assignmentPrefixes);
  const snapshots = snapshotStaticVariableNames(prefixNames, state);
  applyStaticEvalAssignmentPrefixes(invocation.assignmentPrefixes, state);
  const result = runCommandList(invocation.command, state);
  const mutatedNames = staticEvalCommandMutatedNames(invocation.command, prefixNames);
  restoreStaticVariableNames(restoredStaticEvalPrefixSnapshots(snapshots, mutatedNames, invocation.wrapper), state);
  return result;
}

function functionResult(status: StaticFunctionCommandListResult['status']): StaticFunctionCommandListResult {
  return { status, returned: false };
}
