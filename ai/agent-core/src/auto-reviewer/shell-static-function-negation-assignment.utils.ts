import {
  expandShellFunctionCommand,
  type ShellFunctionDefinitions,
} from './shell-function-command.utils';
import {
  applyStaticFunctionState,
} from './shell-static-function-assignment.utils';
import type {
  StaticAssignmentCommandOptions,
  StaticVariableState,
} from './shell-static-assignment.types';
import { withStaticErrexitSuppressed } from './shell-static-errexit-suppression.utils';

type ApplyStaticVariableState = (
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
) => void;

export function applyStaticFunctionStateWithNegation(
  invocation: string,
  body: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  shellFunctions: ShellFunctionDefinitions,
  negationCount: number,
  applyStaticVariableState: ApplyStaticVariableState,
): string | null {
  const applyFunction = () => applyStaticFunctionState(
    expandShellFunctionCommand(invocation, body),
    state,
    options,
    shellFunctions,
    applyStaticVariableState,
  );

  const variant = negationCount > 0
    ? withStaticErrexitSuppressed(state, applyFunction)
    : applyFunction();
  return negationCount === 0 ? variant : null;
}
