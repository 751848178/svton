import type { ShellFunctionDefinitions } from './shell-function-command.utils';
import type {
  StaticAssignmentCommandOptions,
  StaticVariableState,
} from './shell-static-assignment.types';
import { withStaticErrexitSuppressed } from './shell-static-errexit-suppression.utils';

type ApplyStaticVariableState = (
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  evalDepth: number,
  shellFunctions: ShellFunctionDefinitions,
) => void;

export function applyNegatedStaticVariableState(
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  evalDepth: number,
  shellFunctions: ShellFunctionDefinitions,
  applyStaticVariableState: ApplyStaticVariableState,
): void {
  withStaticErrexitSuppressed(
    state,
    () => applyStaticVariableState(statement, state, options, evalDepth, shellFunctions),
  );
}
