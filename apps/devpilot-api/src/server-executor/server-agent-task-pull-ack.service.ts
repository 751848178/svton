import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ServerAgentAuthService, HeaderBag } from "./server-agent-auth.service";
import {
  ServerAgentTaskPullAckDto,
  ServerAgentTaskPullClaimDto,
} from "./dto/server-execution-lease.dto";
import { buildServerAgentTaskPullJobSample } from "./server-agent-task-pull-gates.utils";
import { buildServerAgentTaskPullLockOwner } from "./server-agent-task-pull-lock.utils";
import { isRecord, toJsonValue } from "./server-executor-json.utils";
import { ServerExecutorRuntimeConfigService } from "./server-executor-runtime-config.service";

export const SERVER_AGENT_TASK_PULL_ACK_ENDPOINT =
  "/server-agent/task-pull/ack";

@Injectable()
export class ServerAgentTaskPullAckService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: ServerAgentAuthService,
    private readonly runtimeConfigService: ServerExecutorRuntimeConfigService,
  ) {}

  async ack(headers: HeaderBag, dto: ServerAgentTaskPullAckDto) {
    this.authService.assertTaskPullAuthorized(headers);

    const now = new Date();
    const lockOwner = this.buildLockOwner(dto);
    const lockExpiresAt = this.runtimeConfigService.lockExpiresAt(now);
    const acknowledged = await this.prisma.serverExecutionJob.updateMany({
      where: {
        id: dto.jobId,
        teamId: dto.teamId,
        serverId: dto.serverId,
        transport: "server_agent",
        status: "running",
        lockOwner,
      },
      data: {
        lastHeartbeatAt: now,
        lockExpiresAt,
      },
    });

    if (acknowledged.count === 0) {
      return this.noAck("claimed_job_not_found_or_lock_mismatch");
    }

    const job = await this.prisma.serverExecutionJob.findUnique({
      where: { id: dto.jobId },
      select: taskPullAckJobSelect,
    });
    if (!job) return this.noAck("claimed_job_not_found_or_lock_mismatch");

    const progress = await this.recordProgressIfPresent(
      dto,
      job,
      now,
      lockOwner,
    );

    return {
      accepted: true,
      acked: true,
      reason: "server_agent_job_acknowledged",
      endpoint: SERVER_AGENT_TASK_PULL_ACK_ENDPOINT,
      ack: this.buildAckMetadata(lockOwner, lockExpiresAt),
      job: buildServerAgentTaskPullJobSample(job),
      cancellation: this.buildCancellationHint(job),
      progress,
    };
  }

  private noAck(reason: string) {
    return {
      accepted: true,
      acked: false,
      reason,
      endpoint: SERVER_AGENT_TASK_PULL_ACK_ENDPOINT,
      job: null,
    };
  }

  private buildAckMetadata(lockOwner: string, lockExpiresAt: Date) {
    return {
      mode: "ack_only",
      taskPullEnabled: true,
      ackSupported: true,
      cancellationHintSupported: true,
      progressWritebackSupported: true,
      lifecycleExecutionSupported: false,
      terminalWritebackSupported: true,
      lockOwner,
      lockExpiresAt: lockExpiresAt.toISOString(),
      boundaries: [
        "ack_only",
        "cancellation_hint_only",
        "progress_writeback_only",
        "finish_supported",
        "no_adapter_execution",
      ],
    };
  }

  private buildCancellationHint(job: {
    id: string;
    cancelRequestedAt: Date | null;
    error: string | null;
  }) {
    if (!job.cancelRequestedAt) return null;

    return {
      requested: true,
      shouldStop: true,
      requestedAt: job.cancelRequestedAt.toISOString(),
      finishStatus: "cancelled",
      reason: job.error || "server_execution_job_cancel_requested",
      serverExecutionJobId: job.id,
    };
  }

  private buildLockOwner(dto: ServerAgentTaskPullClaimDto) {
    return buildServerAgentTaskPullLockOwner(dto);
  }

  private async recordProgressIfPresent(
    dto: ServerAgentTaskPullAckDto,
    job: { id: string; metadata: unknown },
    now: Date,
    lockOwner: string,
  ) {
    if (dto.progress === undefined) return null;

    const updatedAt = now.toISOString();
    const metadata = isRecord(job.metadata) ? job.metadata : {};
    const taskPullProgress = {
      updatedAt,
      agentId: dto.agentId.trim(),
      ...(dto.runnerId?.trim() ? { runnerId: dto.runnerId.trim() } : {}),
      progress: dto.progress,
    };
    const recorded = await this.prisma.serverExecutionJob.updateMany({
      where: { id: job.id, status: "running", lockOwner },
      data: {
        metadata: toJsonValue({
          ...metadata,
          taskPullProgress,
        }),
      },
    });

    return {
      recorded: recorded.count > 0,
      updatedAt,
      serverExecutionJobId: job.id,
      ...(recorded.count === 0
        ? { reason: "claimed_job_lock_lost_before_progress_writeback" }
        : {}),
    };
  }
}

const taskPullAckJobSelect = {
  id: true,
  operationKey: true,
  adapterKey: true,
  serverId: true,
  priority: true,
  queuedAt: true,
  availableAt: true,
  cancelRequestedAt: true,
  error: true,
  metadata: true,
  inputSnapshot: true,
  server: {
    select: { id: true, name: true, host: true, status: true },
  },
};
