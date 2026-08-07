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
  CopyEnvironmentConfigRevisionDto,
  CreateEnvironmentConfigRevisionDto,
} from "./dto/environment-config-revision.dto";
import { EnvironmentConfigRevisionService } from "./environment-config-revision.service";
import { ProjectEnvironmentAuthRequest } from "./project-environment-access-policy.types";
import { ProjectEnvironmentReadAccessPolicyService } from "./project-environment-read-access-policy.service";
import { ProjectEnvironmentWriteAccessPolicyService } from "./project-environment-write-access-policy.service";
import { ProjectEnvironmentService } from "./project-environment.service";

@Controller("project-environments")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class ProjectEnvironmentConfigController {
  constructor(
    private readonly environmentService: ProjectEnvironmentService,
    private readonly configRevisionService: EnvironmentConfigRevisionService,
    private readonly readAccessPolicy: ProjectEnvironmentReadAccessPolicyService,
    private readonly writeAccessPolicy: ProjectEnvironmentWriteAccessPolicyService,
  ) {}

  @Get(":id/config-revisions")
  async list(
    @Request() req: ProjectEnvironmentAuthRequest,
    @Param("id") id: string,
  ) {
    const scope = await this.environmentService.getAccessScope(req.teamId, id);
    await this.readAccessPolicy.assertCanReadEnvironment(
      req, id, scope.projectId, scope.environmentId,
    );
    return this.configRevisionService.list(req.teamId, id);
  }

  @Post(":id/config-revisions")
  async create(
    @Request() req: ProjectEnvironmentAuthRequest,
    @Param("id") id: string,
    @Body() dto: CreateEnvironmentConfigRevisionDto,
  ) {
    const scope = await this.environmentService.getAccessScope(req.teamId, id);
    await this.writeAccessPolicy.assertCanCreateConfigRevision(req, scope);
    return this.configRevisionService.create(req.teamId, req.user.id, id, dto);
  }

  @Post(":id/config-revisions/copy")
  async copy(
    @Request() req: ProjectEnvironmentAuthRequest,
    @Param("id") id: string,
    @Body() dto: CopyEnvironmentConfigRevisionDto,
  ) {
    const scope = await this.environmentService.getAccessScope(req.teamId, id);
    await this.writeAccessPolicy.assertCanCreateConfigRevision(req, scope);
    return this.configRevisionService.copyToEnvironments(
      req.teamId, req.user.id, id, dto,
    );
  }
}
