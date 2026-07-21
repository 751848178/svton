export type StaticShellCommandStatus = boolean | null;

export interface StaticShellCommandStatusOptions {
  errexit?: boolean;
  errexitSuppressed?: boolean;
  allexport?: boolean;
  errtrace?: boolean;
  functrace?: boolean;
  pipefail?: boolean;
}

export interface StaticShellCommandExecutionStatus {
  status: StaticShellCommandStatus;
  exitsOnErrexit?: boolean;
}

export type StaticShellCommandStatusResolver = (
  statement: string,
  options?: StaticShellCommandStatusOptions,
) => StaticShellCommandStatus;
