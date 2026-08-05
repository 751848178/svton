import {
  Controller,
  Get,
  Header,
  Param,
  Request,
  UseGuards,
} from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ReleaseBuildService } from "./release-build.service";
import { ReleaseOrderAccessService } from "./release-order-access.service";

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller("projects/:projectId/delivery/releases/:releaseOrderId/builds")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class ReleaseBuildDetailController {
  constructor(
    private readonly builds: ReleaseBuildService,
    private readonly access: ReleaseOrderAccessService,
  ) {}

  @Get(":buildRunId")
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, X-Team-Id, Cookie")
  async get(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("releaseOrderId") releaseOrderId: string,
    @Param("buildRunId") buildRunId: string,
  ) {
    await this.access.assertRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
    });
    return this.builds.get(req.teamId, projectId, releaseOrderId, buildRunId);
  }
}
