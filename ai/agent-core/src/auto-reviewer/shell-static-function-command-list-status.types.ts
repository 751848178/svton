import type { StaticShellCommandStatus } from './shell-static-command-status.types';

export interface StaticShellFunctionStatusResult {
  status: StaticShellCommandStatus;
  returned: boolean;
}

export type RunStaticShellFunctionStatusCommandList = (
  command: string,
) => StaticShellFunctionStatusResult;
