import type { ShellFunctionDefinitions } from './shell-function-command.utils';
import type { StaticAssignmentCommandOptions, StaticVariableState } from './shell-static-assignment.types';
import type { StaticShellCommandExecutionStatus } from './shell-static-command-status.types';
import type {
  StaticFunctionCommandListResult,
  StaticFunctionCommandListStatementResult,
} from './shell-static-function-command-list-assignment.utils';

export type ApplyStaticFunctionVariableState = (
  statement: string,
  state: StaticVariableState,
  options: StaticAssignmentCommandOptions,
  evalDepth?: number,
  shellFunctions?: ShellFunctionDefinitions,
) => void;

export type ReadStaticFunctionCommandExecutionStatus = (
  statement: string,
  state: StaticVariableState,
  shellFunctions: ShellFunctionDefinitions,
) => StaticShellCommandExecutionStatus;

export type RunStaticFunctionCommandList = (
  command: string,
  state: StaticVariableState,
) => StaticFunctionCommandListResult;

export type ApplyStaticFunctionStatementState = (
  statement: string,
  state: StaticVariableState,
) => StaticFunctionCommandListStatementResult;
