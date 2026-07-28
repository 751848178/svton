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
import { ReleasePlanService } from "./release-plan.service";
import { ReleasePlanAccessService } from "./release-plan-access.service";
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
    private readonly releasePlanService: ReleasePlanService,
    private readonly access: ReleasePlanAccessService,
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
    return this.releasePlanService.preview({
      projectId: input.projectId,
      environmentId: dto.environmentId,
      name: dto.name,
      branch: dto.branch,
      commitSha: dto.commitSha,
      gitRepo: dto.gitRepo,
      services,
      serviceDependencies,
      dependencyWarnings,
    });
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
    return this.releasePlanService.create({
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: dto.environmentId,
      name: dto.name,
      branch: dto.branch,
      commitSha: dto.commitSha,
      gitRepo: dto.gitRepo,
      services,
      serviceDependencies,
      dependencyWarnings,
      createdByUserId: input.actorUserId,
      expectedPlanHash: dto.expectedPlanHash,
    });
  }
}
