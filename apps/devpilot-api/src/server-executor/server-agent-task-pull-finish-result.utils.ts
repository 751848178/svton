import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ServerAgentTaskPullFinishDto } from "./dto/server-execution-lease.dto";
import { buildServerAgentTaskPullTerminalCommandPlan } from "./server-agent-task-pull-terminal-plan.utils";
import type { ServerAgentTaskPullTerminalOutcome } from "./server-agent-task-pull-terminal-outcome.utils";
import type { ServerAgentTaskPullFinishSyncService } from "./server-agent-task-pull-finish-sync.service";
import { toJsonValue } from "./server-executor-json.utils";

export const SERVER_AGENT_TASK_PULL_FINISH_ENDPOINT =
  "/server-agent/task-pull/finish";

const TERMINAL_STATUSES = ["completed", "failed", "cancelled"] as const;

export type ServerAgentTaskPullFinishJob = {
  id: string;
  operationKey: string;
  adapterKey: string;
  serverId: string | null;
  inputSnapshot: Prisma.JsonValue;
};

export function buildServerAgentTaskPullFinishData(
  dto: ServerAgentTaskPullFinishDto,
  now: Date,
  commandPlan: Prisma.InputJsonValue | undefined,
  outcome: ServerAgentTaskPullTerminalOutcome,
) {
  return {
    status: dto.status,
    commandPlan,
    logs: outcome.logs,
    result: outcome.result,
    error: dto.error,
    lockedAt: null,
    lockOwner: null,
    lockExpiresAt: null,
    lastHeartbeatAt: null,
    cancelledAt: dto.status === "cancelled" ? now : undefined,
    finishedAt: now,
  };
}

export function resolveServerAgentTaskPullCommandPlan(
  dto: ServerAgentTaskPullFinishDto,
  job: ServerAgentTaskPullFinishJob,
  finishedAt: Date,
): Prisma.InputJsonValue | undefined {
  if (dto.commandPlan !== undefined) return toJsonValue(dto.commandPlan);

  return buildServerAgentTaskPullTerminalCommandPlan(job, {
    teamId: dto.teamId,
    status: dto.status,
    finishedAt,
  });
}

export function buildServerAgentTaskPullFinishMetadata(
  dto: ServerAgentTaskPullFinishDto,
  lockOwner: string,
  finishedAt: Date,
  linkedRunSync: Awaited<
    ReturnType<ServerAgentTaskPullFinishSyncService["syncAfterFinish"]>
  >,
) {
  return {
    mode: "terminal_writeback",
    taskPullEnabled: true,
    lifecycleExecutionSupported: false,
    terminalWritebackSupported: true,
    status: dto.status,
    lockOwner,
    finishedAt: finishedAt.toISOString(),
    lockReleased: true,
    linkedRunSync,
    boundaries: [
      "terminal_writeback_only",
      "linked_business_run_sync_only",
      "no_adapter_execution",
      "no_dispatcher_execution",
      "no_auto_retry",
    ],
  };
}

export function buildServerAgentTaskPullNoFinishResult(reason: string) {
  return {
    accepted: true,
    finished: false,
    reason,
    endpoint: SERVER_AGENT_TASK_PULL_FINISH_ENDPOINT,
    job: null,
  };
}

export function assertServerAgentTaskPullTerminalStatus(value: string) {
  if (
    !TERMINAL_STATUSES.includes(value as (typeof TERMINAL_STATUSES)[number])
  ) {
    throw new BadRequestException(
      "Server agent task-pull terminal status invalid",
    );
  }
}
