import { evalCommandInvocation } from './eval-command-string.utils';
import { splitShellWords } from './shell-command.utils';
import type { ShellFunctionDefinitions } from './shell-function-command.utils';
import type { StaticAssignmentCommandOptions, StaticVariableState } from './shell-static-assignment.types';
import { applyStaticCommandListState } from './shell-static-command-list-assignment.utils';
import {
  applyStaticEvalAssignmentPrefixes,
  restoredStaticEvalPrefixSnapshots,
  staticEvalCommandMutatedNames,
  staticEvalAssignmentPrefixNames,
} from './shell-static-eval-prefix.utils';
import { staticFunctionAwareCommandExecutionStatus } from './shell-static-function-invocation-assignment.utils';
import {
  restoreStaticVariableNames,
  snapshotStaticVariableNames,
} from './shell-static-name-snapshot.utils';
import { substituteStaticShellVariables } from './shell-static-variable-command.utils';

const MAX_STATIC_EVAL_DEPTH = 3;

type ApplyStaticVariableState = (
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  evalDepth?: number,
  shellFunctions?: ShellFunctionDefinitions,
) => void;

export function applyStaticEvalState(
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  evalDepth: number,
  applyStaticVariableState: ApplyStaticVariableState,
  shellFunctions?: ShellFunctionDefinitions,
): boolean {
  if (evalDepth >= MAX_STATIC_EVAL_DEPTH) return false;

  const invocation = evalCommandInvocation(splitShellWords(statement));
  if (!invocation?.command) return false;

  const prefixNames = staticEvalAssignmentPrefixNames(invocation.assignmentPrefixes);
  const snapshots = snapshotStaticVariableNames(prefixNames, state);
  const mutatedPrefixNames = new Set<string>();
  applyStaticEvalAssignmentPrefixes(invocation.assignmentPrefixes, state);
  applyStaticCommandListState(invocation.command, (evalStatement) => {
    const expanded = substituteStaticShellVariables(evalStatement, state.values, state.unsetNames);
    staticEvalCommandMutatedNames(evalStatement, prefixNames)
      .forEach((name) => mutatedPrefixNames.add(name));
    applyStaticVariableState(expanded, state, options, evalDepth + 1, shellFunctions);
    return staticFunctionAwareCommandExecutionStatus(expanded, state, shellFunctions);
  }, state.shellOptions);
  restoreStaticVariableNames(restoredStaticEvalPrefixSnapshots(snapshots, mutatedPrefixNames, invocation.wrapper), state);

  return true;
}
