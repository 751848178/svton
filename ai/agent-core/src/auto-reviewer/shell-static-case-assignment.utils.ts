import { matchingStaticCaseBranch, shellCaseStatement } from './shell-case-parser.utils';
import type { ShellFunctionDefinitions } from './shell-function-command.utils';
import type { StaticAssignmentCommandOptions, StaticVariableState } from './shell-static-assignment.types';
import { applyStaticCommandListState } from './shell-static-command-list-assignment.utils';
import { staticFunctionAwareCommandExecutionStatus } from './shell-static-function-invocation-assignment.utils';
import { staticShellWordValue, substituteStaticShellVariables } from './shell-static-variable-command.utils';

type ApplyStaticVariableState = (
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  evalDepth?: number,
  shellFunctions?: ShellFunctionDefinitions,
) => void;

export function applyStaticCaseState(
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  applyStaticVariableState: ApplyStaticVariableState,
  shellFunctions?: ShellFunctionDefinitions,
): boolean {
  const caseCommand = shellCaseStatement(statement);
  if (!caseCommand) return false;

  const subject = staticShellWordValue(substituteStaticShellVariables(caseCommand.subject, state.values, state.unsetNames));
  if (subject === null) return false;

  const branch = matchingStaticCaseBranch(caseCommand, subject);
  if (branch === null) return false;
  if (!branch) return true;

  applyStaticCommandListState(branch.body, (bodyStatement) => {
    const expanded = substituteStaticShellVariables(bodyStatement, state.values, state.unsetNames);
    applyStaticVariableState(expanded, state, options, undefined, shellFunctions);
    return staticFunctionAwareCommandExecutionStatus(expanded, state, shellFunctions);
  }, state.shellOptions);

  return true;
}
