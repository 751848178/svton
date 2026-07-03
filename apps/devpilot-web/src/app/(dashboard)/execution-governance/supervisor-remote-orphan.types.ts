import type {
  SupervisorBlocker,
  SupervisorNextStep,
  SupervisorServerRef,
} from './supervisor-common.types';

export interface SupervisorRemoteOrphanGovernancePreflight {
  state: 'ready' | 'degraded' | 'blocked' | 'idle' | string;
  reason: string;
  gates: {
    remoteSession: {
      ready: boolean;
      scannedJobs: number;
      recoverableRemoteSessions: number;
      missingRemoteSessions: number;
      invalidRemoteSessions: number;
      reason: string;
    };
    cleanup: {
      ready: boolean;
      enabled: boolean;
      cleanupRecorded: number;
      cleanupAttempted: number;
      cleanupSucceeded: number;
      cleanupFailed: number;
      reason: string;
    };
    owners: {
      ready: boolean;
      activeOwners: number;
      staleOwners: number;
      expiredOwners: number;
      unownedStaleJobs: number;
      reason: string;
    };
    recovery: {
      ready: boolean;
      staleRunningJobs: number;
      scannedJobs: number;
      unscannedStaleJobs: number;
      recoveryBatchSize: number;
      reason: string;
    };
  };
  risk: {
    staleRunningJobs: number;
    scannedJobs: number;
    unscannedStaleJobs: number;
    recoverableRemoteSessions: number;
    missingRemoteSessions: number;
    invalidRemoteSessions: number;
    cleanupRecorded: number;
    cleanupAttempted: number;
    cleanupSucceeded: number;
    cleanupFailed: number;
    activeOwners: number;
    staleOwners: number;
    expiredOwners: number;
    unownedStaleJobs: number;
  };
  samples: SupervisorRemoteOrphanSample[];
  blockers: SupervisorBlocker[];
  nextSteps: SupervisorNextStep[];
}

export interface SupervisorRemoteOrphanSample {
  id: string;
  operationKey: string;
  adapterKey: string;
  serverId?: string | null;
  lockOwner?: string | null;
  lockExpiresAt?: string | null;
  lastHeartbeatAt?: string | null;
  server?: SupervisorServerRef | null;
  remoteSession?: {
    transport: string;
    pid: number;
    observedAt: string;
    serverId?: string | null;
    serverHost?: string | null;
    cleanupStrategy: string;
  } | null;
  cleanup?: {
    attempted: boolean;
    succeeded: boolean;
    failed: boolean;
    reason: string;
    observedAt?: string | null;
    error?: string | null;
  } | null;
}
