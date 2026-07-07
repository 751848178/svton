import { Injectable, Optional } from '@nestjs/common';
import { AuditEventService } from '../audit-event';
import { PrismaService } from '../prisma/prisma.service';
import { SiteService } from '../site';
import { ProjectEnvironmentRepository } from './project-environment.repository';
import { ProjectEnvironmentCopySiteService } from './project-environment-copy-site.service';
import { ProjectEnvironmentSyncService } from './project-environment-sync.service';
import { ProjectEnvironmentSyncApplyService } from './project-environment-sync-apply.service';
import { ProjectEnvironmentResourceCopyService } from './project-environment-resource-copy.service';
import { ProjectEnvironmentCdnCopyService } from './project-environment-cdn-copy.service';
import { ProjectEnvironmentBulkBindService } from './project-environment-bulk-bind.service';
import { ProjectEnvironmentDefaultsService } from './project-environment-defaults.service';
import { ProjectEnvironmentServerBindingService } from './project-environment-server-binding.service';
import { ProjectEnvironmentCrudService } from './project-environment-crud.service';
import {
  ApplyProjectEnvironmentSyncSuggestionsDto,
  BindProjectEnvironmentServerDto,
  BulkBindProjectEnvironmentResourcesDto,
  CopyProjectEnvironmentCdnConfigsDto,
  CopyProjectEnvironmentResourcesDto,
  CopyProjectEnvironmentSitesDto,
  CreateProjectEnvironmentDto,
  ListProjectEnvironmentSyncSuggestionsQueryDto,
  ListProjectEnvironmentsQueryDto,
  UpdateProjectEnvironmentDto,
} from './dto/project-environment.dto';

// Shared domain types live in ./project-environment.types; re-exported here so
// existing `from './project-environment.service'` imports (and the barrel
// index) keep resolving without touching every call site.
export * from './project-environment.types';

@Injectable()
export class ProjectEnvironmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ProjectEnvironmentRepository,
    private readonly copySiteService: ProjectEnvironmentCopySiteService,
    private readonly syncService: ProjectEnvironmentSyncService,
    private readonly syncApplyService: ProjectEnvironmentSyncApplyService,
    private readonly resourceCopyService: ProjectEnvironmentResourceCopyService,
    private readonly cdnCopyService: ProjectEnvironmentCdnCopyService,
    private readonly bulkBindService: ProjectEnvironmentBulkBindService,
    private readonly defaultsService: ProjectEnvironmentDefaultsService,
    private readonly serverBindingService: ProjectEnvironmentServerBindingService,
    private readonly crudService: ProjectEnvironmentCrudService,
    @Optional()
    private readonly auditEventService: AuditEventService,
    @Optional()
    private readonly siteService: SiteService,
  ) {}

  list = (teamId: string, query: ListProjectEnvironmentsQueryDto) =>
    this.crudService.list(teamId, query);

  create = (teamId: string, dto: CreateProjectEnvironmentDto) =>
    this.crudService.create(teamId, dto);

  update = (teamId: string, id: string, dto: UpdateProjectEnvironmentDto) =>
    this.crudService.update(teamId, id, dto);

  archive = (teamId: string, id: string) => this.crudService.archive(teamId, id);

  syncFromProject = (teamId: string, projectId: string) =>
    this.crudService.syncFromProject(teamId, projectId);

  listSyncSuggestions = (
    teamId: string,
    query: ListProjectEnvironmentSyncSuggestionsQueryDto,
    readableEnvironmentIds?: string[],
  ) => this.syncService.listSyncSuggestions(teamId, query, readableEnvironmentIds);

  getSyncApplyAccessScope = (teamId: string, dto: ApplyProjectEnvironmentSyncSuggestionsDto) =>
    this.syncApplyService.getSyncApplyAccessScope(teamId, dto);

  applySyncSuggestions = (teamId: string, userId: string, dto: ApplyProjectEnvironmentSyncSuggestionsDto) =>
    this.syncApplyService.applySyncSuggestions(teamId, userId, dto);


  getResourceBulkBindingAccessScope = (teamId: string, dto: BulkBindProjectEnvironmentResourcesDto) =>
    this.bulkBindService.getResourceBulkBindingAccessScope(teamId, dto);

  bulkBindResources = (teamId: string, userId: string, dto: BulkBindProjectEnvironmentResourcesDto) =>
    this.bulkBindService.bulkBindResources(teamId, userId, dto);

  getCdnConfigCopyAccessScope = (teamId: string, dto: CopyProjectEnvironmentCdnConfigsDto) =>
    this.cdnCopyService.getCdnConfigCopyAccessScope(teamId, dto);

  copyCdnConfigs = (teamId: string, userId: string, dto: CopyProjectEnvironmentCdnConfigsDto) =>
    this.cdnCopyService.copyCdnConfigs(teamId, userId, dto);

  getResourceCopyAccessScope = (teamId: string, dto: CopyProjectEnvironmentResourcesDto) =>
    this.resourceCopyService.getResourceCopyAccessScope(teamId, dto);

  copyResources = (teamId: string, userId: string, dto: CopyProjectEnvironmentResourcesDto) =>
    this.resourceCopyService.copyResources(teamId, userId, dto);

  listServers = (teamId: string, environmentId: string) =>
    this.serverBindingService.listServers(teamId, environmentId);

  getAccessScope = (teamId: string, environmentId: string) =>
    this.serverBindingService.getAccessScope(teamId, environmentId);

  bindServer = (teamId: string, userId: string, environmentId: string, dto: BindProjectEnvironmentServerDto) =>
    this.serverBindingService.bindServer(teamId, userId, environmentId, dto);

  unbindServer = (teamId: string, userId: string, environmentId: string, serverId: string) =>
    this.serverBindingService.unbindServer(teamId, userId, environmentId, serverId);

  ensureDefaultsForProject = (teamId: string, projectId: string, config: unknown) =>
    this.defaultsService.ensureDefaultsForProject(teamId, projectId, config);

  getSiteCopyAccessScope = (teamId: string, dto: CopyProjectEnvironmentSitesDto) =>
    this.copySiteService.getSiteCopyAccessScope(teamId, dto);
  copySites = (teamId: string, userId: string, dto: CopyProjectEnvironmentSitesDto) =>
    this.copySiteService.copySites(teamId, userId, dto);
}
