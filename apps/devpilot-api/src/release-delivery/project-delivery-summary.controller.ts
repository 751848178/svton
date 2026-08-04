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
import { ReleaseOrderAccessService } from "./release-order-access.service";
import { ProjectDeliverySummaryService } from "./project-delivery-summary.service";

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller("projects/:projectId/delivery/summary")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class ProjectDeliverySummaryController {
  constructor(
    private readonly summary: ProjectDeliverySummaryService,
    private readonly access: ReleaseOrderAccessService,
  ) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, X-Team-Id, Cookie")
  async get(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
  ) {
    const scope = { teamId: req.teamId, actorId: req.user.id, projectId };
    await this.access.assertRead(scope);
    return this.summary.get(scope.teamId, scope.actorId, scope.projectId);
  }
}
