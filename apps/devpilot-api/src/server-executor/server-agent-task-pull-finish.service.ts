import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ServerAgentAuthService, HeaderBag } from "./server-agent-auth.service";
import { ServerAgentTaskPullFinishDto } from "./dto/server-execution-lease.dto";
import { buildServerAgentTaskPullJobSample } from "./server-agent-task-pull-gates.utils";
import { buildServerAgentTaskPullLockOwner } from "./server-agent-task-pull-lock.utils";
import {
  assertServerAgentTaskPullTerminalStatus,
  buildServerAgentTaskPullFinishData,
  buildServerAgentTaskPullFinishMetadata,
  buildServerAgentTaskPullNoFinishResult,
  resolveServerAgentTaskPullCommandPlan,
  SERVER_AGENT_TASK_PULL_FINISH_ENDPOINT,
} from "./server-agent-task-pull-finish-result.utils";
import { buildServerAgentTaskPullTerminalOutcome } from "./server-agent-task-pull-terminal-outcome.utils";
import { ServerAgentTaskPullFinishSyncService } from "./server-agent-task-pull-finish-sync.service";

export { SERVER_AGENT_TASK_PULL_FINISH_ENDPOINT } from "./server-agent-task-pull-finish-result.utils";

@Injectable()
export class ServerAgentTaskPullFinishService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: ServerAgentAuthService,
    private readonly finishSyncService: ServerAgentTaskPullFinishSyncService,
  ) {}

  async finish(headers: HeaderBag, dto: ServerAgentTaskPullFinishDto) {
    this.authService.assertTaskPullAuthorized(headers);
    assertServerAgentTaskPullTerminalStatus(dto.status);

    const now = new Date();
    const lockOwner = buildServerAgentTaskPullLockOwner(dto);
    const claimedJob = await this.readClaimedJob(dto, lockOwner);
    if (!claimedJob) {
      return buildServerAgentTaskPullNoFinishResult(
        "claimed_job_not_found_or_lock_mismatch",
      );
    }

    const commandPlan = resolveServerAgentTaskPullCommandPlan(
      dto,
      claimedJob,
      now,
    );
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
      data: buildServerAgentTaskPullFinishData(dto, now, commandPlan, outcome),
    });

    if (finished.count === 0) {
      return buildServerAgentTaskPullNoFinishResult(
        "claimed_job_not_found_or_lock_mismatch",
      );
    }

    const job = await this.prisma.serverExecutionJob.findUnique({
      where: { id: dto.jobId },
      select: taskPullFinishJobSelect,
    });
    if (!job) {
      return buildServerAgentTaskPullNoFinishResult(
        "claimed_job_not_found_or_lock_mismatch",
      );
    }

    const linkedRunSync = await this.finishSyncService.syncAfterFinish(
      { ...dto, commandPlan, logs: outcome.logs, result: outcome.result },
      job,
    );

    return {
      accepted: true,
      finished: true,
      reason: "server_agent_job_finished",
      endpoint: SERVER_AGENT_TASK_PULL_FINISH_ENDPOINT,
      finish: buildServerAgentTaskPullFinishMetadata(
        dto,
        lockOwner,
        now,
        linkedRunSync,
      ),
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
