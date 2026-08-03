import { Controller, Get, Param, Request, UseGuards } from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ReleaseGateCatalogService } from "./release-gate-catalog.service";
import { ReleaseOrderAccessService } from "./release-order-access.service";

interface AuthRequest { user: { id: string }; teamId: string }

@Controller("projects/:projectId/delivery/releases/:releaseOrderId/gates")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class ReleaseGateCatalogController {
  constructor(
    private readonly catalog: ReleaseGateCatalogService,
    private readonly access: ReleaseOrderAccessService,
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
    return this.catalog.get(req.teamId, projectId, releaseOrderId);
  }
}
