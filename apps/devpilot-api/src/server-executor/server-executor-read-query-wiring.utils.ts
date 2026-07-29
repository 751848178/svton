/**
 * Server-executor wiring split: 目标解析 + 读查询服务装配。
 * 从 server-executor-wiring-factory.service.ts 抽离，单一职责——装配
 * targetResolutionService 与 readQueryService。纯装配工厂，无 DI。
 */
import type { PrismaService } from "../prisma/prisma.service";
import { ServerAgentCapabilityService } from "./server-agent-capability.service";
import { ServerExecutorReadQueryService } from "./server-executor-read-query.service";
import { ServerExecutorTargetResolutionService } from "./server-executor-target-resolution.service";
import { ServerExecutorRuntimeConfigService } from "./server-executor-runtime-config.service";

export interface ReadQueryWiringInput {
  prisma: PrismaService;
  agentCapabilityService: ServerAgentCapabilityService;
  runtimeConfigService: ServerExecutorRuntimeConfigService;
  expireStaleLeases: (
    now: Date,
    teamId?: string,
  ) => Promise<number | { count: number }>;
}

export interface ReadQueryWiringServices {
  targetResolutionService: ServerExecutorTargetResolutionService;
  readQueryService: ServerExecutorReadQueryService;
}

export function wireReadQueryServices(
  input: ReadQueryWiringInput,
): ReadQueryWiringServices {
  const targetResolutionService = new ServerExecutorTargetResolutionService(
    input.prisma,
    input.agentCapabilityService,
    () => input.runtimeConfigService.agentTargetEnabled(),
  );
  const readQueryService = new ServerExecutorReadQueryService(
    input.prisma,
    input.expireStaleLeases,
  );
  return { targetResolutionService, readQueryService };
}
