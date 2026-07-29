/**
 * 发布计划 REST API。所有路由在 feature flag 关闭时返回 503（cancel 除外，见下）。
 * 权限：team/project/environment 三层校验，复用 ReleasePlanAccessGuard +
 * ControlAccessPolicyService。
 *
 * Item 3 控制器瘦身：本文件只保留 HTTP 边界（参数接收 + 响应映射 + flag 守卫）。
 * - preview/create 输入装配 → ReleasePlanOrchestratorService
 * - RBAC / project-env 归属 → ReleasePlanAccessGuard
 * - 业务执行（preview/create/execute/cancel/...）→ ReleasePlanService /
 *   ReleaseStageActionService
 * 不持有任何服务级编排逻辑。
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
import { ReleasePlanService } from "./release-plan.service";
import { ReleaseStageActionService } from "./release-stage-action.service";
import { ReleasePlanAccessGuard, type ReleasePlanActor } from "./release-plan-access.guard";
import { ReleasePlanOrchestratorService } from "./release-plan-orchestrator.service";
import {
  CreateReleasePlanDto,
  ListReleasePlansQueryDto,
  PreviewReleasePlanDto,
  SkipReleaseStageDto,
} from "./dto/release-plan.dto";

@Controller("release-plans")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class ReleasePlanController {
  constructor(
    private readonly releasePlanService: ReleasePlanService,
    private readonly stageActionService: ReleaseStageActionService,
    private readonly accessGuard: ReleasePlanAccessGuard,
    private readonly orchestrator: ReleasePlanOrchestratorService,
  ) {}

  @Post("projects/:projectId/preview")
  @HttpCode(200)
  async preview(
    @Request() req: ReleasePlanActor,
    @Param("projectId") projectId: string,
    @Body() dto: PreviewReleasePlanDto,
  ) {
    this.requireEnabled();
    await this.accessGuard.assertProjectAccess(req, projectId, dto.environmentId, "read");
    return this.orchestrator.preview({ teamId: req.teamId, projectId, dto });
  }

  @Post("projects/:projectId")
  async create(
    @Request() req: ReleasePlanActor,
    @Param("projectId") projectId: string,
    @Body() dto: CreateReleasePlanDto,
  ) {
    this.requireEnabled();
    await this.accessGuard.assertProjectAccess(req, projectId, dto.environmentId, "write");
    return this.orchestrator.create({
      teamId: req.teamId,
      projectId,
      actorUserId: req.user.id,
      dto,
    });
  }

  // capability API（architect D9）：不调用 requireEnabled()，
  // 返回 {enabled, canCancel:true, canWrite?, reason?}。canCancel 恒真
  // （cancel 是逃生通道，flag 关闭时仍可用，对应 controller.cancel 有意不守 flag）。
  // 必须放在 @Get(":planId") 之前，否则 "capability" 会被 :planId 捕获。
  @Get("capability")
  async capability(
    @Request() req: ReleasePlanActor,
    @Query("projectId") projectId?: string,
  ) {
    const enabled = this.releasePlanService.isEnabled();
    let canWrite: boolean | undefined;
    if (projectId) {
      try {
        await this.accessGuard.assertProjectAccess(req, projectId, undefined, "write");
        canWrite = true;
      } catch {
        canWrite = false;
      }
    }
    return { enabled, canCancel: true, canWrite, reason: enabled ? null : "flag_off" };
  }

  @Get()
  async list(@Request() req: ReleasePlanActor, @Query() query: ListReleasePlansQueryDto) {
    if (query.projectId) {
      await this.accessGuard.assertProjectAccess(req, query.projectId, query.environmentId, "read");
    }
    return this.releasePlanService.list(req.teamId, query);
  }

  @Get(":planId")
  async get(@Request() req: ReleasePlanActor, @Param("planId") planId: string) {
    const plan = await this.releasePlanService.get(req.teamId, planId);
    await this.accessGuard.assertProjectAccess(req, plan.projectId, plan.environmentId, "read");
    return plan;
  }

  @Post(":planId/execute")
  @HttpCode(200)
  async execute(@Request() req: ReleasePlanActor, @Param("planId") planId: string) {
    this.requireEnabled();
    const plan = await this.releasePlanService.get(req.teamId, planId);
    await this.accessGuard.assertProjectAccess(req, plan.projectId, plan.environmentId, "write");
    await this.releasePlanService.execute(req.teamId, planId, req.user.id);
    return { planId, status: "running" };
  }

  // cancel 是逃生通道，flag 关闭时仍可用，对应 capability.canCancel===true（architect D9）。
  // 故此处有意不调用 requireEnabled()，其余写操作均加 flag 守卫。
  @Post(":planId/cancel")
  @HttpCode(200)
  async cancel(@Request() req: ReleasePlanActor, @Param("planId") planId: string) {
    const plan = await this.releasePlanService.get(req.teamId, planId);
    await this.accessGuard.assertProjectAccess(req, plan.projectId, plan.environmentId, "write");
    await this.releasePlanService.cancel(req.teamId, planId, req.user.id);
    return { planId, status: "canceled" };
  }

  @Post(":planId/stages/:stageId/retry")
  @HttpCode(200)
  async retryStage(
    @Request() req: ReleasePlanActor,
    @Param("planId") planId: string,
    @Param("stageId") stageId: string,
  ) {
    this.requireEnabled();
    const plan = await this.releasePlanService.get(req.teamId, planId);
    await this.accessGuard.assertProjectAccess(req, plan.projectId, plan.environmentId, "write");
    await this.stageActionService.retryStage(req.teamId, planId, stageId, req.user.id);
    return { planId, stageId, status: "retrying" };
  }

  @Post(":planId/stages/:stageId/skip")
  @HttpCode(200)
  async skipStage(
    @Request() req: ReleasePlanActor,
    @Param("planId") planId: string,
    @Param("stageId") stageId: string,
    @Body() dto: SkipReleaseStageDto,
  ) {
    this.requireEnabled();
    const plan = await this.releasePlanService.get(req.teamId, planId);
    await this.accessGuard.assertProjectAccess(req, plan.projectId, plan.environmentId, "write");
    await this.stageActionService.skipStage(req.teamId, planId, stageId, req.user.id, dto);
    return { planId, stageId, status: "skipped" };
  }

  @Post(":planId/stages/:stageId/re-request-approval")
  @HttpCode(200)
  async reRequestApproval(
    @Request() req: ReleasePlanActor,
    @Param("planId") planId: string,
    @Param("stageId") stageId: string,
  ) {
    this.requireEnabled();
    const plan = await this.releasePlanService.get(req.teamId, planId);
    await this.accessGuard.assertProjectAccess(req, plan.projectId, plan.environmentId, "write");
    await this.stageActionService.reRequestApproval(req.teamId, planId, stageId, req.user.id);
    return { planId, stageId, status: "awaiting_approval" };
  }

  private requireEnabled(): void {
    if (!this.releasePlanService.isEnabled()) {
      throw new ForbiddenException("发布编排未启用");
    }
  }
}
