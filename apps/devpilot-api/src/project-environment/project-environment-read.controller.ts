import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  ListProjectEnvironmentSyncSuggestionsQueryDto,
  ListProjectEnvironmentsQueryDto,
} from "./dto/project-environment.dto";
import { ProjectEnvironmentAuthRequest } from "./project-environment-access-policy.types";
import { ProjectEnvironmentReadAccessPolicyService } from "./project-environment-read-access-policy.service";
import { ProjectEnvironmentService } from "./project-environment.service";

const PROJECT_ENVIRONMENT_GUARDS = [JwtAuthGuard, AuthzGuard] as const;

@Controller("project-environments")
@UseGuards(...PROJECT_ENVIRONMENT_GUARDS)
@Roles("team_member")
export class ProjectEnvironmentReadController {
  constructor(
    private readonly environmentService: ProjectEnvironmentService,
    private readonly accessPolicy: ProjectEnvironmentReadAccessPolicyService,
  ) {}

  @Get()
  async list(
    @Request() req: ProjectEnvironmentAuthRequest,
    @Query() query: ListProjectEnvironmentsQueryDto,
  ) {
    const environments = await this.environmentService.list(req.teamId, query);
    return this.accessPolicy.filterReadableEnvironments(req, environments);
  }

  @Get("sync-suggestions")
  async listSyncSuggestions(
    @Request() req: ProjectEnvironmentAuthRequest,
    @Query() query: ListProjectEnvironmentSyncSuggestionsQueryDto,
  ) {
    if (!query.projectId) throw new BadRequestException("projectId 不能为空");
    const environments = await this.environmentService.list(req.teamId, {
      projectId: query.projectId,
      status: "active",
    });
    const readableEnvironments =
      await this.accessPolicy.filterReadableEnvironments(req, environments);
    return this.environmentService.listSyncSuggestions(
      req.teamId,
      query,
      readableEnvironments.map((environment) => environment.id),
    );
  }

  @Get(":id/servers")
  async listServers(
    @Request() req: ProjectEnvironmentAuthRequest,
    @Param("id") id: string,
  ) {
    const scope = await this.environmentService.getAccessScope(req.teamId, id);
    await this.accessPolicy.assertCanReadEnvironment(
      req,
      id,
      scope.projectId,
      scope.environmentId,
    );
    return this.environmentService.listServers(req.teamId, id);
  }
}
