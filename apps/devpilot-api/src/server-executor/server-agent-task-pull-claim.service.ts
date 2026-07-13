import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ServerAgentAuthService, HeaderBag } from "./server-agent-auth.service";
import { ServerAgentCapabilityService } from "./server-agent-capability.service";
import { ServerExecutorRuntimeConfigService } from "./server-executor-runtime-config.service";
import { ServerCommandPolicyService } from "./server-command-policy.service";
import { buildServerExecutorPolicyBlockedResult } from "./server-executor-blocked-result.utils";
import { buildServerAgentTaskPullJobSample } from "./server-agent-task-pull-gates.utils";
import { buildServerAgentTaskPullLockOwner } from "./server-agent-task-pull-lock.utils";
import { ServerAgentTaskPullQueryService } from "./server-agent-task-pull-query.service";
import { ServerAgentTaskPullFinishSyncService } from "./server-agent-task-pull-finish-sync.service";
import { blockServerAgentTaskPullJobForPolicy } from "./server-agent-task-pull-policy-block.utils";
import { readServerAgentRuntimeIdentityMismatch } from "./server-agent-task-pull-runtime-identity.utils";
import {
  buildServerAgentTaskPullClaimBaseResponse,
  buildServerAgentTaskPullClaimMetadata,
  buildServerAgentTaskPullNoClaimResult,
  SERVER_AGENT_TASK_PULL_CLAIM_ENDPOINT,
} from "./server-agent-task-pull-claim-result.utils";
import {
  buildServerAgentClaimedTaskPayload,
  readServerAgentClaimedTaskInput,
  type ServerAgentClaimedTaskJob,
} from "./server-agent-task-pull-task-payload.utils";
import { ServerAgentTaskPullClaimDto } from "./dto/server-execution-lease.dto";

export { SERVER_AGENT_TASK_PULL_CLAIM_ENDPOINT } from "./server-agent-task-pull-claim-result.utils";

type ServerAgentClaimServerRecord = {
  id: string;
  name: string;
  host: string;
  status: string;
  services: Prisma.JsonValue | null;
  tags: Prisma.JsonValue | null;
};

@Injectable()
export class ServerAgentTaskPullClaimService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: ServerAgentAuthService,
    private readonly capabilityService: ServerAgentCapabilityService,
    private readonly runtimeConfigService: ServerExecutorRuntimeConfigService,
    private readonly taskPullQueryService: ServerAgentTaskPullQueryService,
    private readonly commandPolicyService: ServerCommandPolicyService,
    private readonly finishSyncService: ServerAgentTaskPullFinishSyncService,
  ) {}

  async claim(headers: HeaderBag, dto: ServerAgentTaskPullClaimDto) {
    this.authService.assertTaskPullTokenAuthorized(
      headers,
      "Server agent task-pull token 无效",
    );
    const taskPullEnabled = this.authService.taskPullEnabled();

    const now = new Date();
    const server = await this.readServer(dto.teamId, dto.serverId);
    if (!server) {
      throw new NotFoundException("Server agent task-pull 目标服务器不存在");
    }

    const agentRef = this.capabilityService.readCapability(server);
    const runtime = this.capabilityService.readRuntime(server, now);
    const base = buildServerAgentTaskPullClaimBaseResponse(
      dto,
      server,
      now,
      agentRef,
      runtime,
    );
    const identityMismatch = readServerAgentRuntimeIdentityMismatch(
      dto,
      runtime,
    );
    if (identityMismatch) {
      return buildServerAgentTaskPullNoClaimResult(
        `agent_runtime_identity_mismatch:${identityMismatch}`,
      );
    }
    if (!taskPullEnabled) {
      return {
        ...base,
        ...buildServerAgentTaskPullNoClaimResult("task_pull_disabled"),
      };
    }

    const lockOwner = buildServerAgentTaskPullLockOwner(dto);
    const lockExpiresAt = this.runtimeConfigService.lockExpiresAt(now);
    const job = await this.taskPullQueryService.claimNextReadyJob(
      {
        teamId: dto.teamId,
        serverId: dto.serverId,
        transport: "server_agent",
      },
      now,
      lockOwner,
      lockExpiresAt,
    );
    if (!job)
      return buildServerAgentTaskPullNoClaimResult("no_ready_server_agent_job");

    const policyBlocked = await this.blockIfCommandPolicyRejects(
      job,
      dto.teamId,
      lockOwner,
      now,
    );
    if (policyBlocked)
      return buildServerAgentTaskPullNoClaimResult("command_policy_blocked");

    return {
      ...base,
      claimed: true,
      reason: "server_agent_job_claimed",
      endpoint: SERVER_AGENT_TASK_PULL_CLAIM_ENDPOINT,
      claim: buildServerAgentTaskPullClaimMetadata(lockOwner, lockExpiresAt),
      job: buildServerAgentTaskPullJobSample(job),
      task: buildServerAgentClaimedTaskPayload(job, { teamId: dto.teamId }),
    };
  }

  private async readServer(teamId: string, serverId: string) {
    return this.prisma.server.findFirst({
      where: { id: serverId, teamId },
      select: serverSelect,
    }) as Promise<ServerAgentClaimServerRecord | null>;
  }

  private async blockIfCommandPolicyRejects(
    job: ServerAgentClaimedTaskJob,
    teamId: string,
    lockOwner: string,
    now: Date,
  ) {
    const input = readServerAgentClaimedTaskInput(job, teamId);
    if (!input) return false;

    const policy = await this.commandPolicyService.evaluate(input);
    if (policy.status !== "blocked") return false;

    const result = buildServerExecutorPolicyBlockedResult(input, policy);
    const blocked = await blockServerAgentTaskPullJobForPolicy(
      this.prisma,
      job,
      lockOwner,
      result,
      now,
    );
    if (!blocked) return false;

    await this.finishSyncService.syncAfterPolicyBlocked(teamId, job, result);
    return true;
  }
}

const serverSelect = {
  id: true,
  name: true,
  host: true,
  status: true,
  services: true,
  tags: true,
} satisfies Prisma.ServerSelect;
