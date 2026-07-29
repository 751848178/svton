/**
 * Server-executor wiring split: agent-task-pull 服务集群装配。
 * 从 server-executor-wiring-factory.service.ts 抽离，单一职责——装配 agent task pull
 * 相关服务（query / finish-sync / claim / runtime-endpoint）。纯装配工厂，无 DI。
 */
import type { PrismaService } from "../prisma/prisma.service";
import type { JobQueuePort } from "./queue/job-queue.port";
import type { LogCollectionIngestionService } from "../log-center/log-collection-ingestion.service";
import { ServerAgentAuthService } from "./server-agent-auth.service";
import { ServerAgentCapabilityService } from "./server-agent-capability.service";
import { ServerAgentRuntimeEndpointService } from "./server-agent-runtime-endpoint.service";
import { ServerAgentTaskPullClaimService } from "./server-agent-task-pull-claim.service";
import { ServerAgentTaskPullFinishSyncService } from "./server-agent-task-pull-finish-sync.service";
import { ServerAgentTaskPullQueryService } from "./server-agent-task-pull-query.service";
import { ServerCommandPolicyService } from "./server-command-policy.service";
import { ServerExecutorRuntimeConfigService } from "./server-executor-runtime-config.service";

export interface AgentTaskPullWiringInput {
  prisma: PrismaService;
  jobQueue?: JobQueuePort;
  logCollectionIngestionService: LogCollectionIngestionService;
  agentAuthService: ServerAgentAuthService;
  agentCapabilityService: ServerAgentCapabilityService;
  runtimeConfigService: ServerExecutorRuntimeConfigService;
  commandPolicy: ServerCommandPolicyService;
}

export interface AgentTaskPullWiringServices {
  agentTaskPullQueryService: ServerAgentTaskPullQueryService;
  agentTaskPullClaimService: ServerAgentTaskPullClaimService;
  agentRuntimeEndpointService: ServerAgentRuntimeEndpointService;
}

export function wireAgentTaskPullServices(
  input: AgentTaskPullWiringInput,
): AgentTaskPullWiringServices {
  const agentTaskPullQueryService = new ServerAgentTaskPullQueryService(input.prisma);
  const agentTaskPullFinishSyncService = new ServerAgentTaskPullFinishSyncService(
    input.prisma,
    input.logCollectionIngestionService,
    input.jobQueue,
  );
  const agentTaskPullClaimService = new ServerAgentTaskPullClaimService(
    input.prisma,
    input.agentAuthService,
    input.agentCapabilityService,
    input.runtimeConfigService,
    agentTaskPullQueryService,
    input.commandPolicy,
    agentTaskPullFinishSyncService,
  );
  const agentRuntimeEndpointService = new ServerAgentRuntimeEndpointService(
    input.prisma,
    input.agentAuthService,
    input.agentCapabilityService,
    agentTaskPullQueryService,
    agentTaskPullClaimService,
  );
  return {
    agentTaskPullQueryService,
    agentTaskPullClaimService,
    agentRuntimeEndpointService,
  };
}
