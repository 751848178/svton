/**
 * 发布计划编排（F383 Item 3 控制器瘦身）。
 *
 * 单一职责：preview/create 的输入装配——服务端从 ApplicationService.deployConfig
 * 读取命令字段、解析跨服务依赖边（fail-closed），再委托 ReleasePlanService.preview/create。
 * 控制器只保留 HTTP 边界；preview/create 在此处共用同一装配路径，保证 Item 1 §4 一致性。
 *
 * 服务依赖与跨服务依赖均由服务端解析——DTO 不再承载原始 shell 命令或依赖边
 * （invest-3 §A.5 / P0-1），客户端无法注入未校验的跨服务编排。
 */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReleasePlanService } from "./release-plan.service";
import { ReleasePlanAccessService } from "./release-plan-access.service";
import { ReleaseExecutorPreflightService } from "./release-executor-preflight.service";
import {
  readProjectSourceBranch,
  resolveReleaseBranch,
} from "./utils/release-branch-resolution.utils";
import type { ExecutorPreflightWarningSnapshot } from "./utils/release-plan-builder.types";
import type {
  CreateReleasePlanDto,
  PreviewReleasePlanDto,
} from "./dto/release-plan.dto";

export interface PreviewPlanInput {
  teamId: string;
  projectId: string;
  dto: PreviewReleasePlanDto;
}

export interface CreatePlanInput {
  teamId: string;
  projectId: string;
  actorUserId: string;
  dto: CreateReleasePlanDto;
}

@Injectable()
export class ReleasePlanOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly releasePlanService: ReleasePlanService,
    private readonly access: ReleasePlanAccessService,
    private readonly executorPreflight: ReleaseExecutorPreflightService,
  ) {}

  async preview(input: PreviewPlanInput) {
    const { dto } = input;
    const services = await this.access.assertAndResolve(
      input.teamId,
      input.projectId,
      dto.environmentId,
      dto.services,
    );
    // 跨服务依赖边由服务端从 deployConfig.releaseDependencies 解析（P0-1 + Item 1 fail-closed）。
    // resolveServiceDependencies 在任何依赖错误时抛 BadRequestException，控制器透传到 UI。
    // P0-2(b)：同时返回 optional warnings，回传 UI 预览区（不阻断）。
    const { edges: serviceDependencies, warnings: dependencyWarnings } =
      await this.access.resolveServiceDependencies(
        input.teamId,
        input.projectId,
        dto.environmentId,
        services,
      );
    // F383 §B：预览阶段做执行器能力预检，把「不兼容的服务器」提前暴露给用户（不阻断）。
    const executorWarnings = await this.executorPreflight.computeWarnings(
      input.teamId,
      services,
    );
    // F383 §3：分支来源以 Project.config.source.branch 为权威。显式缺失时继承项目配置；
    // 与项目配置不一致时给出 warning。preview/create/ReleasePlan/DeploymentRun/git 命令共用。
    const { resolvedBranch, warnings: branchWarnings } = await this.resolveBranch(
      input.teamId,
      input.projectId,
      dto.branch,
    );
    return this.releasePlanService.preview({
      projectId: input.projectId,
      environmentId: dto.environmentId,
      name: dto.name,
      branch: resolvedBranch,
      commitSha: dto.commitSha,
      gitRepo: dto.gitRepo,
      services,
      serviceDependencies,
      dependencyWarnings,
      executorWarnings: [...executorWarnings, ...toPreflightWarnings(branchWarnings)],
    });
  }

  // 解析权威分支：显式优先，缺失继承项目配置，不一致给出 warning（不阻断）。
  private async resolveBranch(
    teamId: string,
    projectId: string,
    explicitBranch?: string | null,
  ): Promise<{ resolvedBranch: string | undefined; warnings: string[] }> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, teamId },
      select: { config: true },
    });
    const projectBranch = readProjectSourceBranch(project?.config);
    const result = resolveReleaseBranch({ explicitBranch, projectBranch });
    return { resolvedBranch: result.resolvedBranch, warnings: result.warnings };
  }

  async create(input: CreatePlanInput) {
    const { dto } = input;
    const services = await this.access.assertAndResolve(
      input.teamId,
      input.projectId,
      dto.environmentId,
      dto.services,
    );
    const { edges: serviceDependencies, warnings: dependencyWarnings } =
      await this.access.resolveServiceDependencies(
        input.teamId,
        input.projectId,
        dto.environmentId,
        services,
      );
    const executorWarnings = await this.executorPreflight.computeWarnings(
      input.teamId,
      services,
    );
    // F383 §3：与 preview 同一分支装配路径，确保 create 冻结的快照分支一致。
    const { resolvedBranch, warnings: branchWarnings } = await this.resolveBranch(
      input.teamId,
      input.projectId,
      dto.branch,
    );
    return this.releasePlanService.create({
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: dto.environmentId,
      name: dto.name,
      branch: resolvedBranch,
      commitSha: dto.commitSha,
      gitRepo: dto.gitRepo,
      services,
      serviceDependencies,
      dependencyWarnings,
      executorWarnings: [...executorWarnings, ...toPreflightWarnings(branchWarnings)],
      createdByUserId: input.actorUserId,
      expectedPlanHash: dto.expectedPlanHash,
    });
  }
}

// 把分支解析的字符串告警归一为 executor-preflight 告警快照形态（项目级，用哨兵 id 标记）。
function toPreflightWarnings(
  messages: string[],
): ExecutorPreflightWarningSnapshot[] {
  return messages.map((reason) => ({
    applicationServiceId: "__project_branch__",
    serviceName: "__project_branch__",
    serverId: "__project_branch__",
    reason: "branch-resolution",
    suggestedAction: reason,
  }));
}
