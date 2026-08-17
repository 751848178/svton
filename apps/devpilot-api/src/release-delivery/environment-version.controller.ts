import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  EnvironmentVersionRecoveryConfirmDto,
  EnvironmentVersionRecoveryPreviewDto,
} from "./dto/environment-version-recovery.dto";
import {
  CreateEnvironmentVersionActionDto,
  ReconcileProductionPromotionDto,
  ResumeProductionPromotionDto,
} from "./dto/environment-version.dto";
import { EnvironmentVersionRecoveryService } from "./environment-version-recovery.service";
import { EnvironmentVersionService } from "./environment-version.service";
import { ReleaseOrderAccessService } from "./release-order-access.service";
import { ProductionPromotionReconcileService } from "./production-promotion-reconcile.service";

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller("projects/:projectId/delivery/environment-versions")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class EnvironmentVersionController {
  constructor(
    private readonly versions: EnvironmentVersionService,
    private readonly recovery: EnvironmentVersionRecoveryService,
    private readonly access: ReleaseOrderAccessService,
    private readonly promotionReconcile: ProductionPromotionReconcileService,
  ) {}

  @Get()
  async list(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
  ) {
    await this.access.assertRead(this.scope(req, projectId));
    return this.versions.list(req.teamId, projectId);
  }

  @Post(":environmentId/production-promotion/reconcile")
  async reconcileProductionPromotion(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("environmentId") environmentId: string,
    @Body() dto: ReconcileProductionPromotionDto,
  ) {
    await this.access.assertConfirmProduction(this.scope(req, projectId));
    return this.promotionReconcile.reconcile({
      ...dto, teamId: req.teamId, projectId,
      environmentId, actorId: req.user.id,
    });
  }

  @Post(":environmentId/production-promotion/resume")
  async resumeProductionPromotion(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("environmentId") environmentId: string,
    @Body() dto: ResumeProductionPromotionDto,
  ) {
    await this.access.assertConfirmProduction(this.scope(req, projectId));
    return this.versions.resumeProductionPromotion({
      ...dto,
      teamId: req.teamId,
      projectId,
      actorId: req.user.id,
      environmentId,
    });
  }

  @Post(":environmentId/actions")
  async execute(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("environmentId") environmentId: string,
    @Body() dto: CreateEnvironmentVersionActionDto,
  ) {
    await this.access.assertDeployEnvironment(this.scope(req, projectId));
    return this.versions.execute({
      ...dto,
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
    });
  }

  @Post(":environmentId/recovery/preview")
  async recoveryPreview(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("environmentId") environmentId: string,
    @Body() dto: EnvironmentVersionRecoveryPreviewDto,
  ) {
    await this.access.assertRead(this.scope(req, projectId));
    return this.recovery.preview({
      teamId: req.teamId,
      projectId,
      environmentId,
      sourceVersionId: dto.sourceVersionId,
    });
  }

  @Post(":environmentId/recovery/confirm")
  async recoveryConfirm(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("environmentId") environmentId: string,
    @Body() dto: EnvironmentVersionRecoveryConfirmDto,
  ) {
    await this.access.assertConfirmProduction(this.scope(req, projectId));
    return this.recovery.confirm({
      ...dto,
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
    });
  }

  private scope(req: AuthRequest, projectId: string) {
    return { teamId: req.teamId, actorId: req.user.id, projectId };
  }
}
