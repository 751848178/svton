import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ServerAgentAuthService, HeaderBag } from "./server-agent-auth.service";
import {
  ServerAgentTaskPullAckDto,
  ServerAgentTaskPullClaimDto,
} from "./dto/server-execution-lease.dto";
import {
  buildServerAgentTaskPullAckMetadata,
  buildServerAgentTaskPullCancellationHint,
  buildServerAgentTaskPullNoAckResult,
  SERVER_AGENT_TASK_PULL_ACK_ENDPOINT,
} from "./server-agent-task-pull-ack-result.utils";
import { buildServerAgentTaskPullJobSample } from "./server-agent-task-pull-gates.utils";
import { buildServerAgentTaskPullLockOwner } from "./server-agent-task-pull-lock.utils";
import { isRecord, toJsonValue } from "./server-executor-json.utils";
import { ServerExecutorRuntimeConfigService } from "./server-executor-runtime-config.service";

export { SERVER_AGENT_TASK_PULL_ACK_ENDPOINT };

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
      return buildServerAgentTaskPullNoAckResult(
        "claimed_job_not_found_or_lock_mismatch",
      );
    }

    const job = await this.prisma.serverExecutionJob.findUnique({
      where: { id: dto.jobId },
      select: taskPullAckJobSelect,
    });
    if (!job) {
      return buildServerAgentTaskPullNoAckResult(
        "claimed_job_not_found_or_lock_mismatch",
      );
    }

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
      ack: buildServerAgentTaskPullAckMetadata(lockOwner, lockExpiresAt),
      job: buildServerAgentTaskPullJobSample(job),
      cancellation: buildServerAgentTaskPullCancellationHint(job),
      progress,
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
