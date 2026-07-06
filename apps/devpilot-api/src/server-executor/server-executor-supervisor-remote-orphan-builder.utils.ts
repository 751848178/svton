import {
  RemoteOrphanGovernancePreflightSeverity,
  RemoteOrphanGovernancePreflightState,
} from "./server-executor-supervisor.types";
import {
  RemoteOrphanBlockerResult,
  RemoteOrphanGovernancePreflightInput,
  RemoteOrphanJobSummary,
  RemoteOrphanScanResult,
} from "./server-executor-supervisor-remote-orphan-input.types";

export function buildRemoteOrphanState(
  staleRunningJobs: number,
  blockers: {
    reason: string;
    severity: RemoteOrphanGovernancePreflightSeverity;
    count: number;
  }[],
): {
  state: RemoteOrphanGovernancePreflightState;
  reason: string;
  needsDefaultNextStep: boolean;
} {
  const criticalBlocker = blockers.find((b) => b.severity === "critical");
  const warningBlocker = blockers.find((b) => b.severity === "warning");
  let state: RemoteOrphanGovernancePreflightState = "ready";
  if (staleRunningJobs === 0) state = "idle";
  else if (criticalBlocker) state = "blocked";
  else if (warningBlocker) state = "degraded";
  const reason =
    state === "idle"
      ? "no_stale_remote_orphans"
      : criticalBlocker?.reason ||
        warningBlocker?.reason ||
        "remote_orphan_governance_ready";
  return { state, reason, needsDefaultNextStep: true };
}

export function buildRemoteOrphanResult(args: {
  input: RemoteOrphanGovernancePreflightInput;
  scan: RemoteOrphanScanResult;
  jobSummaries: RemoteOrphanJobSummary[];
  state: RemoteOrphanGovernancePreflightState;
  reason: string;
  blockers: RemoteOrphanBlockerResult["blockers"];
  nextSteps: RemoteOrphanBlockerResult["nextSteps"];
}) {
  const { input: inp, scan } = args;
  return {
    state: args.state,
    reason: args.reason,
    gates: {
      remoteSession: {
        ready:
          scan.missingRemoteSessions === 0 && scan.invalidRemoteSessions === 0,
        scannedJobs: scan.scannedJobs,
        recoverableRemoteSessions: scan.recoverableRemoteSessions,
        missingRemoteSessions: scan.missingRemoteSessions,
        invalidRemoteSessions: scan.invalidRemoteSessions,
        reason:
          inp.staleRunningJobs === 0
            ? "no_stale_running_jobs"
            : scan.missingRemoteSessions > 0
              ? "missing_remote_execution_session"
              : scan.invalidRemoteSessions > 0
                ? "invalid_remote_execution_session"
                : scan.recoverableRemoteSessions > 0
                  ? "remote_sessions_tracked"
                  : "no_recoverable_remote_sessions",
      },
      cleanup: {
        ready:
          inp.staleRemoteCleanupEnabled || scan.recoverableRemoteSessions === 0,
        enabled: inp.staleRemoteCleanupEnabled,
        cleanupRecorded: scan.cleanupRecorded,
        cleanupAttempted: scan.cleanupAttempted,
        cleanupSucceeded: scan.cleanupSucceeded,
        cleanupFailed: scan.cleanupFailed,
        reason:
          scan.recoverableRemoteSessions === 0
            ? "no_remote_sessions_to_cleanup"
            : inp.staleRemoteCleanupEnabled
              ? "stale_remote_cleanup_enabled"
              : "remote_cleanup_disabled_with_recoverable_sessions",
      },
      owners: {
        ready:
          inp.expiredOwners === 0 &&
          inp.staleOwners === 0 &&
          scan.unownedStaleJobs === 0,
        activeOwners: inp.activeOwners,
        staleOwners: inp.staleOwners,
        expiredOwners: inp.expiredOwners,
        unownedStaleJobs: scan.unownedStaleJobs,
        reason:
          inp.expiredOwners > 0
            ? "expired_worker_owner"
            : inp.staleOwners > 0
              ? "stale_worker_owner"
              : scan.unownedStaleJobs > 0
                ? "unowned_stale_running_jobs"
                : "remote_owner_state_ready",
      },
      recovery: {
        ready:
          scan.unscannedStaleJobs === 0 &&
          inp.staleRunningJobs <= inp.recoveryBatchSize,
        staleRunningJobs: inp.staleRunningJobs,
        scannedJobs: scan.scannedJobs,
        unscannedStaleJobs: scan.unscannedStaleJobs,
        recoveryBatchSize: inp.recoveryBatchSize,
        reason:
          inp.staleRunningJobs === 0
            ? "no_stale_running_jobs"
            : scan.unscannedStaleJobs > 0
              ? "stale_jobs_scan_truncated"
              : inp.staleRunningJobs > inp.recoveryBatchSize
                ? "recovery_batch_below_stale_jobs"
                : "stale_recovery_batch_ready",
      },
    },
    risk: {
      staleRunningJobs: inp.staleRunningJobs,
      scannedJobs: scan.scannedJobs,
      unscannedStaleJobs: scan.unscannedStaleJobs,
      recoverableRemoteSessions: scan.recoverableRemoteSessions,
      missingRemoteSessions: scan.missingRemoteSessions,
      invalidRemoteSessions: scan.invalidRemoteSessions,
      cleanupRecorded: scan.cleanupRecorded,
      cleanupAttempted: scan.cleanupAttempted,
      cleanupSucceeded: scan.cleanupSucceeded,
      cleanupFailed: scan.cleanupFailed,
      activeOwners: inp.activeOwners,
      staleOwners: inp.staleOwners,
      expiredOwners: inp.expiredOwners,
      unownedStaleJobs: scan.unownedStaleJobs,
    },
    samples: args.jobSummaries.slice(0, 5).map((summary) => ({
      id: summary.job.id,
      operationKey: summary.job.operationKey,
      adapterKey: summary.job.adapterKey,
      serverId: summary.job.serverId,
      lockOwner: summary.job.lockOwner,
      lockExpiresAt: summary.job.lockExpiresAt?.toISOString() || null,
      lastHeartbeatAt: summary.job.lastHeartbeatAt?.toISOString() || null,
      server: summary.job.server || null,
      remoteSession: summary.session
        ? {
            transport: summary.session.transport,
            pid: summary.session.pid,
            observedAt: summary.session.observedAt,
            serverId: summary.session.serverId ?? null,
            serverHost: summary.session.serverHost ?? null,
            cleanupStrategy: summary.session.cleanupStrategy,
          }
        : null,
      cleanup: summary.cleanup,
    })),
    blockers: args.blockers,
    nextSteps: args.nextSteps,
  };
}
