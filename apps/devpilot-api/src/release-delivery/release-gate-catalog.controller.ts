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
import { ReleaseGateCatalogService } from "./release-gate-catalog.service";
import { ReleaseOrderAccessService } from "./release-order-access.service";
import { ConfirmReleaseGateDto } from "./dto/release-gate-confirmation.dto";
import { ReleaseGateManualConfirmationService } from "./release-gate-manual-confirmation.service";

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller("projects/:projectId/delivery/releases/:releaseOrderId/gates")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class ReleaseGateCatalogController {
  constructor(
    private readonly catalog: ReleaseGateCatalogService,
    private readonly access: ReleaseOrderAccessService,
    private readonly confirmations: ReleaseGateManualConfirmationService,
  ) {}

  @Get()
  async get(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("releaseOrderId") releaseOrderId: string,
  ) {
    await this.access.assertRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
    });
    return this.catalog.get(req.teamId, projectId, releaseOrderId, req.user.id);
  }

  @Post(":gateId/evaluations/:evaluationId/confirm")
  async confirm(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("releaseOrderId") releaseOrderId: string,
    @Param("gateId") gateId: string,
    @Param("evaluationId") evaluationId: string,
    @Body() dto: ConfirmReleaseGateDto,
  ) {
    await this.access.assertBuild({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
    });
    return this.confirmations.confirm({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      releaseOrderId,
      gateId,
      evaluationId,
      reason: dto.reason,
    });
  }
}
