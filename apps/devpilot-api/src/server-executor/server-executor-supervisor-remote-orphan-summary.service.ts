import { Injectable } from "@nestjs/common";
import { RemoteOrphanGovernancePreflightSeverity } from "./server-executor-supervisor.types";
import {
  isSupervisorRecord,
  readRemoteExecutionCleanupSummary,
  readRemoteExecutionSession,
} from "./server-executor-supervisor-reader.utils";
import {
  buildRemoteOrphanResult,
  buildRemoteOrphanState,
} from "./server-executor-supervisor-remote-orphan-builder.utils";
import {
  RemoteOrphanGovernancePreflightInput,
  RemoteOrphanJobSummary,
} from "./server-executor-supervisor-remote-orphan-input.types";
import { collectRemoteOrphanBlockers } from "./server-executor-supervisor-remote-orphan-blockers.utils";

@Injectable()
export class ServerExecutorSupervisorRemoteOrphanSummaryService {
  summarize(input: RemoteOrphanGovernancePreflightInput) {
    const blockers: {
      reason: string;
      severity: RemoteOrphanGovernancePreflightSeverity;
      count: number;
    }[] = [];
    const nextSteps: { action: string; reason: string }[] = [];
    const nextStepKeys = new Set<string>();
    const jobSummaries: RemoteOrphanJobSummary[] = input.staleJobs.map(
      (job) => {
        const metadata = isSupervisorRecord(job.metadata) ? job.metadata : {};
        const remoteExecution = isSupervisorRecord(metadata.remoteExecution)
          ? metadata.remoteExecution
          : {};
        const sessionValue = remoteExecution.session;
        const session = readRemoteExecutionSession(sessionValue);
        const cleanup =
          readRemoteExecutionCleanupSummary(remoteExecution.staleCleanup) ||
          readRemoteExecutionCleanupSummary(remoteExecution.cleanup);
        return {
          job,
          session,
          cleanup,
          hasSessionMetadata:
            sessionValue !== undefined && sessionValue !== null,
        };
      },
    );

    const scan = this.computeScan(input, jobSummaries);

    const addBlocker = (
      reason: string,
      severity: RemoteOrphanGovernancePreflightSeverity,
      count = 1,
    ) => {
      if (count > 0) blockers.push({ reason, severity, count });
    };
    const addNextStep = (action: string, reason: string) => {
      const key = `${action}:${reason}`;
      if (nextStepKeys.has(key)) return;
      nextStepKeys.add(key);
      nextSteps.push({ action, reason });
    };

    collectRemoteOrphanBlockers(input, scan, addBlocker, addNextStep);

    const { state, reason } = buildRemoteOrphanState(
      input.staleRunningJobs,
      blockers,
    );
    if (nextSteps.length === 0) {
      nextSteps.push({
        action:
          state === "idle"
            ? "monitor_stale_remote_orphans"
            : "ready_for_remote_orphan_governance",
        reason,
      });
    }

    return buildRemoteOrphanResult({
      input,
      scan,
      jobSummaries,
      state,
      reason,
      blockers,
      nextSteps,
    });
  }

  private computeScan(
    input: RemoteOrphanGovernancePreflightInput,
    jobSummaries: RemoteOrphanJobSummary[],
  ) {
    const scannedJobs = jobSummaries.length;
    const unscannedStaleJobs = Math.max(
      0,
      input.staleRunningJobs - scannedJobs,
    );
    return {
      scannedJobs,
      unscannedStaleJobs,
      recoverableRemoteSessions: jobSummaries.filter((s) => s.session).length,
      missingRemoteSessions: jobSummaries.filter(
        (s) => !s.session && !s.hasSessionMetadata,
      ).length,
      invalidRemoteSessions: jobSummaries.filter(
        (s) => !s.session && s.hasSessionMetadata,
      ).length,
      cleanupRecorded: jobSummaries.filter((s) => s.cleanup).length,
      cleanupAttempted: jobSummaries.filter((s) => s.cleanup?.attempted).length,
      cleanupSucceeded: jobSummaries.filter((s) => s.cleanup?.succeeded).length,
      cleanupFailed: jobSummaries.filter((s) => s.cleanup?.failed).length,
      unownedStaleJobs: jobSummaries.filter((s) => !s.job.lockOwner).length,
    };
  }
}
