import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  ApplyProjectEnvironmentSyncSuggestionsDto,
  BindProjectEnvironmentServerDto,
  BulkBindProjectEnvironmentResourcesDto,
  CopyProjectEnvironmentCdnConfigsDto,
  CopyProjectEnvironmentResourcesDto,
  CopyProjectEnvironmentSitesDto,
  CreateProjectEnvironmentDto,
  SyncProjectEnvironmentsDto,
  UpdateProjectEnvironmentDto,
} from "./dto/project-environment.dto";
import { ProjectEnvironmentAuthRequest } from "./project-environment-access-policy.types";
import { ProjectEnvironmentCopyAccessPolicyService } from "./project-environment-copy-access-policy.service";
import { ProjectEnvironmentWriteAccessPolicyService } from "./project-environment-write-access-policy.service";
import { ProjectEnvironmentService } from "./project-environment.service";

const PROJECT_ENVIRONMENT_GUARDS = [JwtAuthGuard, AuthzGuard] as const;

@Controller("project-environments")
@UseGuards(...PROJECT_ENVIRONMENT_GUARDS)
@Roles("team_member")
export class ProjectEnvironmentWriteController {
  constructor(
    private readonly environmentService: ProjectEnvironmentService,
    private readonly writeAccessPolicy: ProjectEnvironmentWriteAccessPolicyService,
    private readonly copyAccessPolicy: ProjectEnvironmentCopyAccessPolicyService,
  ) {}

  @Post()
  async create(
    @Request() req: ProjectEnvironmentAuthRequest,
    @Body() dto: CreateProjectEnvironmentDto,
  ) {
    await this.writeAccessPolicy.assertCanCreate(req, dto.projectId);
    return this.environmentService.create(req.teamId, dto);
  }

  @Post("sync-suggestions/apply")
  async applySyncSuggestions(
    @Request() req: ProjectEnvironmentAuthRequest,
    @Body() dto: ApplyProjectEnvironmentSyncSuggestionsDto,
  ) {
    const scope = await this.environmentService.getSyncApplyAccessScope(
      req.teamId,
      dto,
    );
    await this.copyAccessPolicy.assertCanApplySyncSuggestions(
      req,
      scope,
      dto.dryRun,
    );
    return this.environmentService.applySyncSuggestions(
      req.teamId,
      req.user.id,
      dto,
    );
  }

  @Post("resources/bulk-bind")
  async bulkBindResources(
    @Request() req: ProjectEnvironmentAuthRequest,
    @Body() dto: BulkBindProjectEnvironmentResourcesDto,
  ) {
    const scope =
      await this.environmentService.getResourceBulkBindingAccessScope(
        req.teamId,
        dto,
      );
    await this.writeAccessPolicy.assertCanBulkBindResources(
      req,
      scope,
      dto.dryRun,
    );
    return this.environmentService.bulkBindResources(
      req.teamId,
      req.user.id,
      dto,
    );
  }

  @Post("sites/copy")
  async copySites(
    @Request() req: ProjectEnvironmentAuthRequest,
    @Body() dto: CopyProjectEnvironmentSitesDto,
  ) {
    const scope = await this.environmentService.getSiteCopyAccessScope(
      req.teamId,
      dto,
    );
    await this.copyAccessPolicy.assertCanCopySites(req, scope, dto.dryRun);
    return this.environmentService.copySites(req.teamId, req.user.id, dto);
  }

  @Post("cdn-configs/copy")
  async copyCdnConfigs(
    @Request() req: ProjectEnvironmentAuthRequest,
    @Body() dto: CopyProjectEnvironmentCdnConfigsDto,
  ) {
    const scope = await this.environmentService.getCdnConfigCopyAccessScope(
      req.teamId,
      dto,
    );
    await this.copyAccessPolicy.assertCanCopyCdnConfigs(req, scope, dto.dryRun);
    return this.environmentService.copyCdnConfigs(req.teamId, req.user.id, dto);
  }

  @Post("resources/copy")
  async copyResources(
    @Request() req: ProjectEnvironmentAuthRequest,
    @Body() dto: CopyProjectEnvironmentResourcesDto,
  ) {
    const scope = await this.environmentService.getResourceCopyAccessScope(
      req.teamId,
      dto,
    );
    await this.copyAccessPolicy.assertCanCopyResources(req, scope, dto.dryRun);
    return this.environmentService.copyResources(req.teamId, req.user.id, dto);
  }

  @Put(":id")
  async update(
    @Request() req: ProjectEnvironmentAuthRequest,
    @Param("id") id: string,
    @Body() dto: UpdateProjectEnvironmentDto,
  ) {
    const scope = await this.environmentService.getAccessScope(req.teamId, id);
    await this.writeAccessPolicy.assertCanUpdate(req, id, scope);
    return this.environmentService.update(req.teamId, id, dto);
  }

  @Delete(":id")
  async archive(
    @Request() req: ProjectEnvironmentAuthRequest,
    @Param("id") id: string,
  ) {
    const scope = await this.environmentService.getAccessScope(req.teamId, id);
    await this.writeAccessPolicy.assertCanArchive(req, id, scope);
    return this.environmentService.archive(req.teamId, id);
  }

  @Post(":id/servers")
  async bindServer(
    @Request() req: ProjectEnvironmentAuthRequest,
    @Param("id") id: string,
    @Body() dto: BindProjectEnvironmentServerDto,
  ) {
    const scope = await this.environmentService.getAccessScope(req.teamId, id);
    await this.writeAccessPolicy.assertCanBindServer(req, scope, dto.serverId);
    return this.environmentService.bindServer(req.teamId, req.user.id, id, dto);
  }

  @Delete(":id/servers/:serverId")
  async unbindServer(
    @Request() req: ProjectEnvironmentAuthRequest,
    @Param("id") id: string,
    @Param("serverId") serverId: string,
  ) {
    const scope = await this.environmentService.getAccessScope(req.teamId, id);
    await this.writeAccessPolicy.assertCanUnbindServer(req, scope, serverId);
    return this.environmentService.unbindServer(
      req.teamId,
      req.user.id,
      id,
      serverId,
    );
  }

  @Post("sync-from-project")
  async syncFromProject(
    @Request() req: ProjectEnvironmentAuthRequest,
    @Body() dto: SyncProjectEnvironmentsDto,
  ) {
    await this.writeAccessPolicy.assertCanSyncFromProject(req, dto.projectId);
    return this.environmentService.syncFromProject(req.teamId, dto.projectId);
  }
}
