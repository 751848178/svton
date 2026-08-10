import { Controller, Get, Param, Request, UseGuards } from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ReleaseDeliveryCompatibilityService } from "./release-delivery-compatibility.service";
import { ReleaseOrderAccessService } from "./release-order-access.service";

interface AuthRequest { user: { id: string }; teamId: string }

@Controller("projects/:projectId/delivery/compatibility")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class ReleaseDeliveryCompatibilityController {
  constructor(
    private readonly compatibility: ReleaseDeliveryCompatibilityService,
    private readonly access: ReleaseOrderAccessService,
  ) {}

  @Get()
  async get(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
  ) {
    await this.access.assertRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
    });
    return this.compatibility.get(req.teamId, projectId);
  }
}
