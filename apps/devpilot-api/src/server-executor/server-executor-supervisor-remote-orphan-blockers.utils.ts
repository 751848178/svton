import { RemoteOrphanGovernancePreflightSeverity } from "./server-executor-supervisor.types";
import {
  RemoteOrphanGovernancePreflightInput,
  RemoteOrphanScanResult,
} from "./server-executor-supervisor-remote-orphan-input.types";

type AddBlocker = (
  reason: string,
  severity: RemoteOrphanGovernancePreflightSeverity,
  count?: number,
) => void;
type AddNextStep = (action: string, reason: string) => void;

export function collectRemoteOrphanBlockers(
  input: RemoteOrphanGovernancePreflightInput,
  scan: RemoteOrphanScanResult,
  addBlocker: AddBlocker,
  addNextStep: AddNextStep,
) {
  if (!input.staleRemoteCleanupEnabled && scan.recoverableRemoteSessions > 0) {
    addBlocker(
      "remote_cleanup_disabled_with_recoverable_sessions",
      "critical",
      scan.recoverableRemoteSessions,
    );
    addNextStep(
      "enable_stale_remote_cleanup",
      "remote_cleanup_disabled_with_recoverable_sessions",
    );
  }
  if (scan.missingRemoteSessions > 0) {
    addBlocker(
      "missing_remote_execution_session",
      "warning",
      scan.missingRemoteSessions,
    );
    addNextStep(
      "inspect_remote_execution_metadata",
      "missing_remote_execution_session",
    );
  }
  if (scan.invalidRemoteSessions > 0) {
    addBlocker(
      "invalid_remote_execution_session",
      "warning",
      scan.invalidRemoteSessions,
    );
    addNextStep(
      "inspect_remote_execution_metadata",
      "invalid_remote_execution_session",
    );
  }
  if (input.expiredOwners > 0) {
    addBlocker("expired_worker_owner", "warning", input.expiredOwners);
    addNextStep("recover_expired_worker_owner", "expired_worker_owner");
  }
  if (input.staleOwners > 0) {
    addBlocker("stale_worker_owner", "warning", input.staleOwners);
    addNextStep("inspect_worker_owners", "stale_worker_owner");
  }
  if (scan.unownedStaleJobs > 0) {
    addBlocker("unowned_stale_running_jobs", "warning", scan.unownedStaleJobs);
    addNextStep("inspect_unowned_running_jobs", "unowned_stale_running_jobs");
  }
  if (scan.cleanupFailed > 0) {
    addBlocker("remote_cleanup_failed", "warning", scan.cleanupFailed);
    addNextStep("inspect_failed_remote_cleanup", "remote_cleanup_failed");
  }
  if (scan.unscannedStaleJobs > 0) {
    addBlocker("stale_jobs_scan_truncated", "warning", scan.unscannedStaleJobs);
    addNextStep("expand_stale_job_scan", "stale_jobs_scan_truncated");
  }
  if (input.staleRunningJobs > input.recoveryBatchSize) {
    addBlocker(
      "recovery_batch_below_stale_jobs",
      "warning",
      input.staleRunningJobs - input.recoveryBatchSize,
    );
    addNextStep("tune_stale_recovery_batch", "recovery_batch_below_stale_jobs");
  }
}
