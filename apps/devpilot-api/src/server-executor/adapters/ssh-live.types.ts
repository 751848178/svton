export type SshCommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cancelled: boolean;
  remoteProcessPid?: number;
  remoteKill?: {
    attempted: boolean;
    reason?: "cancel" | "timeout";
    succeeded?: boolean;
    error?: string;
  };
};
