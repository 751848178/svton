import { Body, Controller, Param, Post, Request, UseGuards } from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ProductionReleasePreviewDto } from "./dto/release-production.dto";
import { ReleaseOrderAccessService } from "./release-order-access.service";
import { ReleaseProductionService } from "./release-production.service";

type AuthRequest = { user: { id: string }; teamId: string };

@Controller("projects/:projectId/delivery/releases/:releaseOrderId")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class ReleaseProductionPreflightController {
  constructor(
    private readonly production: ReleaseProductionService,
    private readonly access: ReleaseOrderAccessService,
  ) {}

  @Post("production-preflight-refresh")
  async refresh(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("releaseOrderId") releaseOrderId: string,
    @Body() dto: ProductionReleasePreviewDto,
  ) {
    await this.access.assertConfirmProduction({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
    });
    return this.production.refreshPreflight(
      req.teamId,
      projectId,
      releaseOrderId,
      dto.manifestId,
      req.user.id,
      dto.strategy,
    );
  }
}
