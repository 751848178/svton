/**
 * 发布计划 REST API。所有路由在 feature flag 关闭时返回 503。
 * 权限：team/project/environment 三层校验，复用 ControlAccessPolicyService。
 */
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ControlAccessPolicyService } from "../control-access-policy";
import { PrismaService } from "../prisma/prisma.service";
import { ReleasePlanService } from "./release-plan.service";
import {
  CreateReleasePlanDto,
  ListReleasePlansQueryDto,
  PreviewReleasePlanDto,
  SkipReleaseStageDto,
} from "./dto/release-plan.dto";

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller("release-plans")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class ReleasePlanController {
  constructor(
    private readonly releasePlanService: ReleasePlanService,
    private readonly accessPolicy: ControlAccessPolicyService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("projects/:projectId/preview")
  @HttpCode(200)
  async preview(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Body() dto: PreviewReleasePlanDto,
  ) {
    this.requireEnabled();
    await this.assertProjectAccess(req, projectId, dto.environmentId, "read");
    return this.releasePlanService.preview({
      projectId,
      environmentId: dto.environmentId,
      name: dto.name,
      branch: dto.branch,
      commitSha: dto.commitSha,
      gitRepo: dto.gitRepo,
      services: dto.services,
      serviceDependencies: dto.serviceDependencies as never,
    });
  }

  @Post("projects/:projectId")
  async create(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Body() dto: CreateReleasePlanDto,
  ) {
    this.requireEnabled();
    await this.assertProjectAccess(req, projectId, dto.environmentId, "write");
    return this.releasePlanService.create({
      teamId: req.teamId,
      projectId,
      environmentId: dto.environmentId,
      name: dto.name,
      branch: dto.branch,
      commitSha: dto.commitSha,
      gitRepo: dto.gitRepo,
      services: dto.services,
      serviceDependencies: dto.serviceDependencies as never,
      createdByUserId: req.user.id,
    });
  }

  @Get()
  async list(@Request() req: AuthRequest, @Query() query: ListReleasePlansQueryDto) {
    if (query.projectId) {
      await this.assertProjectAccess(req, query.projectId, query.environmentId, "read");
    }
    return this.releasePlanService.list(req.teamId, query);
  }

  @Get(":planId")
  async get(@Request() req: AuthRequest, @Param("planId") planId: string) {
    const plan = await this.releasePlanService.get(req.teamId, planId);
    await this.assertProjectAccess(req, plan.projectId, plan.environmentId, "read");
    return plan;
  }

  @Post(":planId/execute")
  @HttpCode(200)
  async execute(@Request() req: AuthRequest, @Param("planId") planId: string) {
    this.requireEnabled();
    const plan = await this.releasePlanService.get(req.teamId, planId);
    await this.assertProjectAccess(req, plan.projectId, plan.environmentId, "write");
    await this.releasePlanService.execute(req.teamId, planId, req.user.id);
    return { planId, status: "running" };
  }

  @Post(":planId/cancel")
  @HttpCode(200)
  async cancel(@Request() req: AuthRequest, @Param("planId") planId: string) {
    // cancel 是逃生通道，flag 关闭时仍可用，对应 capability.canCancel===true（architect D9）。
    // 故此处有意不调用 requireEnabled()，其余写操作（preview/create/execute/retry/skip/re-request-approval）均加 flag 守卫。
    const plan = await this.releasePlanService.get(req.teamId, planId);
    await this.assertProjectAccess(req, plan.projectId, plan.environmentId, "write");
    await this.releasePlanService.cancel(req.teamId, planId, req.user.id);
    return { planId, status: "canceled" };
  }

  @Post(":planId/stages/:stageId/retry")
  @HttpCode(200)
  async retryStage(
    @Request() req: AuthRequest,
    @Param("planId") planId: string,
    @Param("stageId") stageId: string,
  ) {
    this.requireEnabled();
    const plan = await this.releasePlanService.get(req.teamId, planId);
    await this.assertProjectAccess(req, plan.projectId, plan.environmentId, "write");
    await this.releasePlanService.retryStage(req.teamId, planId, stageId, req.user.id);
    return { planId, stageId, status: "retrying" };
  }

  @Post(":planId/stages/:stageId/skip")
  @HttpCode(200)
  async skipStage(
    @Request() req: AuthRequest,
    @Param("planId") planId: string,
    @Param("stageId") stageId: string,
    @Body() dto: SkipReleaseStageDto,
  ) {
    this.requireEnabled();
    const plan = await this.releasePlanService.get(req.teamId, planId);
    await this.assertProjectAccess(req, plan.projectId, plan.environmentId, "write");
    await this.releasePlanService.skipStage(
      req.teamId,
      planId,
      stageId,
      req.user.id,
      dto,
    );
    return { planId, stageId, status: "skipped" };
  }

  @Post(":planId/stages/:stageId/re-request-approval")
  @HttpCode(200)
  async reRequestApproval(
    @Request() req: AuthRequest,
    @Param("planId") planId: string,
    @Param("stageId") stageId: string,
  ) {
    this.requireEnabled();
    const plan = await this.releasePlanService.get(req.teamId, planId);
    await this.assertProjectAccess(req, plan.projectId, plan.environmentId, "write");
    await this.releasePlanService.reRequestApproval(
      req.teamId,
      planId,
      stageId,
      req.user.id,
    );
    return { planId, stageId, status: "awaiting_approval" };
  }

  private requireEnabled(): void {
    if (!this.releasePlanService.isEnabled()) {
      throw new ForbiddenException("发布编排未启用");
    }
  }

  // 校验 team→project→environment 归属 + control_access_policy phase
  private async assertProjectAccess(
    req: AuthRequest,
    projectId: string,
    environmentId: string | null | undefined,
    phase: "read" | "write",
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, teamId: req.teamId },
      select: { id: true },
    });
    if (!project) throw new ForbiddenException("无权访问该项目");
    if (environmentId) {
      const env = await this.prisma.projectEnvironment.findFirst({
        where: { id: environmentId, projectId, teamId: req.teamId },
        select: { id: true },
      });
      if (!env) throw new ForbiddenException("无权访问该环境");
    }
    const method = phase === "read" ? "assertCanRead" : "assertCanWrite";
    await this.accessPolicy[method]({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId: environmentId ?? undefined,
      category: "release_plan",
      action: phase === "read" ? "release_plan.read" : "release_plan.write",
      targetType: "project",
      targetId: projectId,
      risk: phase === "write" ? "high" : "low",
    });
  }
}
