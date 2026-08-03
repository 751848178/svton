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
import { CreateEnvironmentVersionActionDto } from "./dto/environment-version.dto";
import { EnvironmentVersionService } from "./environment-version.service";
import { ReleaseOrderAccessService } from "./release-order-access.service";

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
    private readonly access: ReleaseOrderAccessService,
  ) {}

  @Get()
  async list(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
  ) {
    await this.access.assertRead(this.scope(req, projectId));
    return this.versions.list(req.teamId, projectId);
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

  private scope(req: AuthRequest, projectId: string) {
    return { teamId: req.teamId, actorId: req.user.id, projectId };
  }
}
