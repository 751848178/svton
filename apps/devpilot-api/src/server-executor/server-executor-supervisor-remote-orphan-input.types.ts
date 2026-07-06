import { RemoteOrphanGovernancePreflightSeverity } from "./server-executor-supervisor.types";
import { RemoteExecutionCleanupSummary } from "./server-executor-supervisor-reader.utils";
import { ServerRemoteExecutionSession } from "./server-executor.types";

export type RemoteOrphanStaleJob = {
  id: string;
  operationKey: string;
  adapterKey: string;
  serverId: string | null;
  lockOwner: string | null;
  lastHeartbeatAt: Date | null;
  lockExpiresAt: Date | null;
  metadata?: unknown;
  server?: { id: string; name: string; host: string; status: string } | null;
};

export type RemoteOrphanGovernancePreflightInput = {
  now: Date;
  staleRemoteCleanupEnabled: boolean;
  recoveryBatchSize: number;
  staleRunningJobs: number;
  activeOwners: number;
  staleOwners: number;
  expiredOwners: number;
  staleJobs: RemoteOrphanStaleJob[];
};

export type RemoteOrphanJobSummary = {
  job: RemoteOrphanStaleJob;
  session: ServerRemoteExecutionSession | undefined;
  cleanup: RemoteExecutionCleanupSummary | null;
  hasSessionMetadata: boolean;
};

export type RemoteOrphanScanResult = {
  scannedJobs: number;
  unscannedStaleJobs: number;
  recoverableRemoteSessions: number;
  missingRemoteSessions: number;
  invalidRemoteSessions: number;
  cleanupRecorded: number;
  cleanupAttempted: number;
  cleanupSucceeded: number;
  cleanupFailed: number;
  unownedStaleJobs: number;
};

export type RemoteOrphanBlockerResult = {
  blockers: {
    reason: string;
    severity: RemoteOrphanGovernancePreflightSeverity;
    count: number;
  }[];
  nextSteps: { action: string; reason: string }[];
};
