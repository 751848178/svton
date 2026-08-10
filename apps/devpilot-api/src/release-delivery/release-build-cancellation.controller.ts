import { Controller, Param, Post, Request, UseGuards } from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ReleaseBuildCancellationService } from "./release-build-cancellation.service";
import { ReleaseOrderAccessService } from "./release-order-access.service";

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller("projects/:projectId/delivery/releases/:releaseOrderId/builds")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class ReleaseBuildCancellationController {
  constructor(
    private readonly cancellations: ReleaseBuildCancellationService,
    private readonly access: ReleaseOrderAccessService,
  ) {}

  @Post(":buildRunId/cancel")
  async cancel(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("releaseOrderId") releaseOrderId: string,
    @Param("buildRunId") buildRunId: string,
  ) {
    await this.access.assertBuild({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
    });
    return this.cancellations.cancel({
      teamId: req.teamId,
      projectId,
      releaseOrderId,
      buildRunId,
    });
  }
}
