import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ServerAgentAuthService, HeaderBag } from "./server-agent-auth.service";
import { ServerAgentTaskPullFinishDto } from "./dto/server-execution-lease.dto";
import { buildServerAgentTaskPullJobSample } from "./server-agent-task-pull-gates.utils";
import { buildServerAgentTaskPullLockOwner } from "./server-agent-task-pull-lock.utils";
import { buildServerAgentTaskPullTerminalCommandPlan } from "./server-agent-task-pull-terminal-plan.utils";
import {
  buildServerAgentTaskPullTerminalOutcome,
  ServerAgentTaskPullTerminalOutcome,
} from "./server-agent-task-pull-terminal-outcome.utils";
import { ServerAgentTaskPullFinishSyncService } from "./server-agent-task-pull-finish-sync.service";
import { toJsonValue } from "./server-executor-json.utils";

export const SERVER_AGENT_TASK_PULL_FINISH_ENDPOINT =
  "/server-agent/task-pull/finish";

const TERMINAL_STATUSES = ["completed", "failed", "cancelled"] as const;

@Injectable()
export class ServerAgentTaskPullFinishService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: ServerAgentAuthService,
    private readonly finishSyncService: ServerAgentTaskPullFinishSyncService,
  ) {}

  async finish(headers: HeaderBag, dto: ServerAgentTaskPullFinishDto) {
    this.authService.assertTaskPullAuthorized(headers);
    this.assertTerminalStatus(dto.status);

    const now = new Date();
    const lockOwner = buildServerAgentTaskPullLockOwner(dto);
    const claimedJob = await this.readClaimedJob(dto, lockOwner);
    if (!claimedJob) {
      return this.noFinish("claimed_job_not_found_or_lock_mismatch");
    }

    const commandPlan = this.resolveCommandPlan(dto, claimedJob, now);
    const outcome = buildServerAgentTaskPullTerminalOutcome(dto, claimedJob.id);
    const finished = await this.prisma.serverExecutionJob.updateMany({
      where: {
        id: dto.jobId,
        teamId: dto.teamId,
        serverId: dto.serverId,
        transport: "server_agent",
        status: "running",
        lockOwner,
      },
      data: this.buildFinishData(dto, now, commandPlan, outcome),
    });

    if (finished.count === 0) {
      return this.noFinish("claimed_job_not_found_or_lock_mismatch");
    }

    const job = await this.prisma.serverExecutionJob.findUnique({
      where: { id: dto.jobId },
      select: taskPullFinishJobSelect,
    });
    if (!job) return this.noFinish("claimed_job_not_found_or_lock_mismatch");

    const linkedRunSync = await this.finishSyncService.syncAfterFinish(
      { ...dto, commandPlan, logs: outcome.logs, result: outcome.result },
      job,
    );

    return {
      accepted: true,
      finished: true,
      reason: "server_agent_job_finished",
      endpoint: SERVER_AGENT_TASK_PULL_FINISH_ENDPOINT,
      finish: this.buildFinishMetadata(dto, lockOwner, now, linkedRunSync),
      job: buildServerAgentTaskPullJobSample(job),
    };
  }

  private async readClaimedJob(
    dto: ServerAgentTaskPullFinishDto,
    lockOwner: string,
  ) {
    return this.prisma.serverExecutionJob.findFirst({
      where: {
        id: dto.jobId,
        teamId: dto.teamId,
        serverId: dto.serverId,
        transport: "server_agent",
        status: "running",
        lockOwner,
      },
      select: taskPullFinishJobSelect,
    });
  }

  private buildFinishData(
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

  private resolveCommandPlan(
    dto: ServerAgentTaskPullFinishDto,
    job: NonNullable<Awaited<ReturnType<typeof this.readClaimedJob>>>,
    finishedAt: Date,
  ): Prisma.InputJsonValue | undefined {
    if (dto.commandPlan !== undefined) return toJsonValue(dto.commandPlan);

    return buildServerAgentTaskPullTerminalCommandPlan(job, {
      teamId: dto.teamId,
      status: dto.status,
      finishedAt,
    });
  }

  private buildFinishMetadata(
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

  private noFinish(reason: string) {
    return {
      accepted: true,
      finished: false,
      reason,
      endpoint: SERVER_AGENT_TASK_PULL_FINISH_ENDPOINT,
      job: null,
    };
  }

  private assertTerminalStatus(value: string) {
    if (
      !TERMINAL_STATUSES.includes(value as (typeof TERMINAL_STATUSES)[number])
    ) {
      throw new BadRequestException(
        "Server agent task-pull terminal status invalid",
      );
    }
  }
}

const taskPullFinishJobSelect = {
  id: true,
  teamId: true,
  actorId: true,
  retryOfId: true,
  attempt: true,
  maxAttempts: true,
  operationKey: true,
  adapterKey: true,
  serverId: true,
  priority: true,
  queuedAt: true,
  availableAt: true,
  inputSnapshot: true,
  server: {
    select: { id: true, name: true, host: true, status: true },
  },
};
