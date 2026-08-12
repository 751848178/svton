export type ReleaseWorkloadExecutionMode =
  | "managed-process-v1"
  | "managed-command-v1";

export interface ReleaseStagingWorkloadHealth {
  url: string;
  origin: string;
  maxAttempts: number;
  intervalMs: number;
  timeoutMs: number;
}

export interface ReleaseStagingWorkload {
  serviceId: string;
  applicationId: string;
  componentKey: string;
  name: string;
  kind: string;
  ports?: number[];
  artifactDigest: string;
  workingDirectory: string;
  executionMode: ReleaseWorkloadExecutionMode;
  startCommand: string;
  statusCommand?: string;
  failureCleanupCommand?: string;
  startTimeoutMs: number;
  statusTimeoutMs: number;
  resources?: {
    cpuMillicores: number;
    memoryBytes: number;
    diskBytes: number;
  };
  health?: ReleaseStagingWorkloadHealth;
  stateHash: string;
}

export interface ReleaseStagingWorkloadSnapshot {
  version: 1;
  environmentId: string;
  manifestId: string;
  manifestDigest: string;
  services: ReleaseStagingWorkload[];
  inputHash: string;
}

export interface ReleaseWorkloadCommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cancelled: boolean;
}

export type ReleaseWorkloadCommandExecutor = (
  script: string,
  timeoutMs: number,
) => Promise<ReleaseWorkloadCommandResult>;

export interface ReleaseWorkloadPaths {
  releaseRoot: string;
  runtimePath: string;
}
