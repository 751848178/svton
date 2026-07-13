import { Prisma } from "@prisma/client";
import type { ServerAgentTaskPullFinishDto } from "./dto/server-execution-lease.dto";
import { rehydrateServerExecutionInput } from "./server-executor-input-snapshot.utils";
import {
  isRecord,
  readOptionalString,
  toJsonValue,
} from "./server-executor-json.utils";
import type {
  ServerExecutionInput,
  ServerExecutionResult,
} from "./server-executor.types";

export type ServerAgentTaskPullFinishSyncJob = {
  id: string;
  teamId: string;
  actorId: string | null;
  retryOfId: string | null;
  attempt: number;
  maxAttempts: number;
  adapterKey: string;
  inputSnapshot: Prisma.JsonValue;
};

const SERVER_AGENT_TASK_PULL_NON_LOG_BUSINESS_RUN_SYNC_TYPES = new Set([
  "deployment",
  "site_sync",
  "resource_action",
  "service_operation",
  "backup_run",
]);

export function readServerAgentTaskPullFinishSyncMetadata(
  snapshot: Prisma.JsonValue,
): Record<string, unknown> {
  if (!isRecord(snapshot)) return {};
  return isRecord(snapshot.metadata) ? snapshot.metadata : {};
}

export function readServerAgentTaskPullFinishSyncBusinessRunSync(
  metadata: Record<string, unknown>,
) {
  return readOptionalString(metadata.businessRunSync);
}

export function readServerAgentTaskPullFinishSyncLogCollectionRunId(
  metadata: Record<string, unknown>,
) {
  return readOptionalString(metadata.logCollectionRunId) || null;
}

export function isServerAgentTaskPullNonLogBusinessRunSync(
  value: string | null | undefined,
) {
  return (
    !!value && SERVER_AGENT_TASK_PULL_NON_LOG_BUSINESS_RUN_SYNC_TYPES.has(value)
  );
}

export function rehydrateServerAgentTaskPullFinishSyncInput(
  dto: ServerAgentTaskPullFinishDto,
  job: ServerAgentTaskPullFinishSyncJob,
): ServerExecutionInput {
  return rehydrateServerExecutionInput(job.inputSnapshot, {
    teamId: dto.teamId,
    userId: job.actorId || undefined,
    retryOfJobId: job.retryOfId || undefined,
    retryAttempt: job.attempt,
    maxAttempts: job.maxAttempts,
  });
}

export function rehydrateServerAgentTaskPullPolicyBlockedSyncInput(
  job: ServerAgentTaskPullFinishSyncJob,
  teamId: string,
): ServerExecutionInput {
  return rehydrateServerExecutionInput(job.inputSnapshot, {
    teamId,
    userId: job.actorId || undefined,
    retryOfJobId: job.retryOfId || undefined,
    retryAttempt: job.attempt,
    maxAttempts: job.maxAttempts,
  });
}

export function buildServerAgentTaskPullFinishSyncExecutionResult(
  dto: ServerAgentTaskPullFinishDto,
  input: ServerExecutionInput,
  job: ServerAgentTaskPullFinishSyncJob,
): ServerExecutionResult {
  return {
    status: dto.status,
    mode: dto.status === "cancelled" ? "cancelled" : "executed",
    executorKey: "server-executor",
    adapterKey: job.adapterKey,
    executable: dto.status === "completed",
    warnings: input.warnings || [],
    commandSteps: input.steps,
    commandPlan: toJsonValue(dto.commandPlan ?? null),
    logs: toJsonValue(dto.logs ?? []),
    result: toJsonValue(
      dto.result ?? {
        mode: "agent_task_pull_terminal_writeback",
        serverExecutionJobId: job.id,
        status: dto.status,
      },
    ),
    error: dto.error,
  };
}

export function buildServerAgentTaskPullLogCollectionSyncResult(
  dto: ServerAgentTaskPullFinishDto,
  logCollectionRunId: string,
  synced: boolean,
) {
  return {
    businessRunSync: "log_collection",
    logCollectionRunId,
    synced,
    completedIngestionAttempted: synced && dto.status === "completed",
  };
}
