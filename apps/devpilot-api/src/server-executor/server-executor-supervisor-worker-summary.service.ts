import { Injectable } from "@nestjs/common";
import {
  ExecutionAuditEventRecord,
  WorkerLockRecord,
  WorkerLockSummary,
} from "./server-executor-supervisor.types";
import {
  formatSupervisorCountMap,
  summarizeExecutionAuditMetadata,
} from "./server-executor-supervisor-reader.utils";

@Injectable()
export class ServerExecutorSupervisorWorkerSummaryService {
  summarizeWorkerLocks(
    workerLocks: WorkerLockRecord[],
    now: Date,
  ): WorkerLockSummary[] {
    const workers = new Map<
      string,
      {
        lockOwner: string;
        runningJobs: number;
        staleJobs: number;
        lastHeartbeatAt: Date | null;
        lockExpiresAt: Date | null;
        sampleJob: WorkerLockSummary["sampleJob"];
      }
    >();

    for (const lock of workerLocks) {
      if (!lock.lockOwner) continue;

      const existing = workers.get(lock.lockOwner);
      const stale = Boolean(
        lock.lockExpiresAt && lock.lockExpiresAt.getTime() <= now.getTime(),
      );
      if (!existing) {
        workers.set(lock.lockOwner, {
          lockOwner: lock.lockOwner,
          runningJobs: 1,
          staleJobs: stale ? 1 : 0,
          lastHeartbeatAt: lock.lastHeartbeatAt,
          lockExpiresAt: lock.lockExpiresAt,
          sampleJob: {
            id: lock.id,
            operationKey: lock.operationKey,
            adapterKey: lock.adapterKey,
            serverId: lock.serverId,
            server: lock.server,
          },
        });
        continue;
      }

      existing.runningJobs += 1;
      if (stale) existing.staleJobs += 1;
      if (
        lock.lastHeartbeatAt &&
        (!existing.lastHeartbeatAt ||
          lock.lastHeartbeatAt > existing.lastHeartbeatAt)
      ) {
        existing.lastHeartbeatAt = lock.lastHeartbeatAt;
        existing.lockExpiresAt = lock.lockExpiresAt;
        existing.sampleJob = {
          id: lock.id,
          operationKey: lock.operationKey,
          adapterKey: lock.adapterKey,
          serverId: lock.serverId,
          server: lock.server,
        };
      }
    }

    return [...workers.values()].map((worker) => ({
      lockOwner: worker.lockOwner,
      runningJobs: worker.runningJobs,
      staleJobs: worker.staleJobs,
      lastHeartbeatAt: worker.lastHeartbeatAt?.toISOString() ?? null,
      lockExpiresAt: worker.lockExpiresAt?.toISOString() ?? null,
      sampleJob: worker.sampleJob,
    }));
  }

  summarizeExecutionAuditVisibility(events: ExecutionAuditEventRecord[]) {
    const statusCounts = new Map<string, number>();
    const riskCounts = new Map<string, number>();
    const actionCounts = new Map<string, number>();

    for (const event of events) {
      statusCounts.set(event.status, (statusCounts.get(event.status) || 0) + 1);
      riskCounts.set(event.risk, (riskCounts.get(event.risk) || 0) + 1);
      actionCounts.set(event.action, (actionCounts.get(event.action) || 0) + 1);
    }

    return {
      totalRecent: events.length,
      failedRecent: statusCounts.get("failed") || 0,
      blockedRecent: statusCounts.get("blocked") || 0,
      highRiskRecent: riskCounts.get("high") || 0,
      statuses: formatSupervisorCountMap(statusCounts, "status"),
      risks: formatSupervisorCountMap(riskCounts, "risk"),
      actions: formatSupervisorCountMap(actionCounts, "action"),
      samples: events.slice(0, 8).map((event) => {
        const metadata = summarizeExecutionAuditMetadata(event.metadata);
        const serverExecutionJobId =
          metadata.serverExecutionJobId || event.targetId || null;

        return {
          id: event.id,
          action: event.action,
          targetId: event.targetId,
          serverExecutionJobId,
          risk: event.risk,
          status: event.status,
          summary: event.summary,
          occurredAt: event.occurredAt.toISOString(),
          actor: event.actor,
          project: event.project,
          environment: event.environment,
          server: event.server,
          metadata: { ...metadata, serverExecutionJobId },
        };
      }),
    };
  }
}
