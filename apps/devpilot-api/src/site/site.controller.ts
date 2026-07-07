import {
  Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards,
} from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateSiteDto, CreateSiteDiagnosticsDto, CreateSiteOpenRestyModuleBaselineDto,
  CreateSiteOpenRestyModulesDto, CreateSiteOpenRestyStatusDto, CreateSiteSmokeCheckDto,
  CreateSiteSyncPlanDto, CreateSiteTlsProbeDto, CreateSiteTlsRenewDto,
  ListSiteSyncRunsQueryDto, ListSitesQueryDto, PreviewSiteTakeoverDto,
  RollbackSiteSyncRunDto, UpdateSiteDto,
} from './dto/site.dto';
import { SiteService } from './site.service';
import { SiteAccessPolicyService, SiteAuthRequest } from './site-access-policy.service';

const GUARDS = [JwtAuthGuard, AuthzGuard] as const;

@Controller('sites')
@UseGuards(...GUARDS)
@Roles('team_member')
export class SiteReadController {
  constructor(
    private readonly siteService: SiteService,
    private readonly accessPolicy: SiteAccessPolicyService,
  ) {}

  @Get()
  async listSites(@Request() req: SiteAuthRequest, @Query() query: ListSitesQueryDto) {
    const sites = await this.siteService.listSites(req.teamId, query);
    return this.accessPolicy.filterReadableSiteRecords(req, sites, 'site.read', 'site');
  }

  @Get(':id')
  async getSite(@Request() req: SiteAuthRequest, @Param('id') id: string) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.accessPolicy.assertCanReadSite(req, 'site.read', id, site.projectId, site.environmentId, 'site');
    return site;
  }

  @Get(':id/sync-runs')
  async listSyncRuns(@Request() req: SiteAuthRequest, @Param('id') id: string, @Query() query: ListSiteSyncRunsQueryDto) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.accessPolicy.assertCanReadSite(req, 'site.read', id, site.projectId, site.environmentId, 'site');
    const runs = await this.siteService.listSyncRuns(req.teamId, id, query);
    return this.accessPolicy.filterReadableSiteRecords(req, runs, 'site_sync_run.read', 'site_sync_run');
  }
}

@Controller('sites')
@UseGuards(...GUARDS)
@Roles('team_member')
export class SiteWriteController {
  constructor(
    private readonly siteService: SiteService,
    private readonly accessPolicy: SiteAccessPolicyService,
  ) {}

  @Post()
  async createSite(@Request() req: SiteAuthRequest, @Body() dto: CreateSiteDto) {
    await this.accessPolicy.assertCanWriteSite(req, 'site.create', dto.projectId || '', dto.projectId, dto.environmentId);
    return this.siteService.createSite(req.teamId, req.user.id, dto);
  }

  @Put(':id')
  async updateSite(@Request() req: SiteAuthRequest, @Param('id') id: string, @Body() dto: UpdateSiteDto) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.accessPolicy.assertCanWriteSite(req, 'site.update', id, site.projectId, site.environmentId, 'medium');
    if ((dto.projectId && dto.projectId !== site.projectId) || (dto.environmentId && dto.environmentId !== site.environmentId)) {
      await this.accessPolicy.assertCanWriteSite(req, 'site.update', id, dto.projectId || site.projectId, dto.environmentId || site.environmentId, 'medium');
    }
    return this.siteService.updateSite(req.teamId, id, dto);
  }

  @Delete(':id')
  async deleteSite(@Request() req: SiteAuthRequest, @Param('id') id: string) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.accessPolicy.assertCanWriteSite(req, 'site.delete', id, site.projectId, site.environmentId, 'high');
    return this.siteService.deleteSite(req.teamId, id);
  }

  @Post(':id/preview-takeover')
  @Roles('team_admin')
  async takeoverPreviewSite(@Request() req: SiteAuthRequest, @Param('id') id: string, @Body() dto: PreviewSiteTakeoverDto) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.accessPolicy.assertCanWriteSite(req, 'site.preview_takeover', id, site.projectId, site.environmentId, 'medium');
    return this.siteService.takeoverPreviewSite(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/sync-plan')
  @Roles('team_admin')
  async createSyncPlan(@Request() req: SiteAuthRequest, @Param('id') id: string, @Body() dto: CreateSiteSyncPlanDto) {
    await this.assertSiteWrite(req, id, 'site.sync', dto.dryRun === false ? 'medium' : 'low');
    return this.siteService.createSyncPlan(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/diagnostics')
  @Roles('team_admin')
  async createDiagnostics(@Request() req: SiteAuthRequest, @Param('id') id: string, @Body() dto: CreateSiteDiagnosticsDto) {
    await this.assertSiteWrite(req, id, 'site.diagnostics', dto.dryRun === false ? 'medium' : 'low');
    return this.siteService.createDiagnostics(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/openresty-module-baseline')
  @Roles('team_admin')
  async createOpenRestyModuleBaseline(@Request() req: SiteAuthRequest, @Param('id') id: string, @Body() dto: CreateSiteOpenRestyModuleBaselineDto) {
    await this.assertSiteWrite(req, id, 'site.openresty_module_baseline', 'low');
    return this.siteService.createOpenRestyModuleBaseline(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/openresty-modules')
  @Roles('team_admin')
  async createOpenRestyModules(@Request() req: SiteAuthRequest, @Param('id') id: string, @Body() dto: CreateSiteOpenRestyModulesDto) {
    await this.assertSiteWrite(req, id, 'site.openresty_modules', 'low');
    return this.siteService.createOpenRestyModules(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/openresty-status')
  @Roles('team_admin')
  async createOpenRestyStatus(@Request() req: SiteAuthRequest, @Param('id') id: string, @Body() dto: CreateSiteOpenRestyStatusDto) {
    await this.assertSiteWrite(req, id, 'site.openresty_status', 'low');
    return this.siteService.createOpenRestyStatus(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/smoke-check')
  @Roles('team_admin')
  async createSmokeCheck(@Request() req: SiteAuthRequest, @Param('id') id: string, @Body() dto: CreateSiteSmokeCheckDto) {
    await this.assertSiteWrite(req, id, 'site.smoke_check', 'low');
    return this.siteService.createSmokeCheck(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/tls-probe')
  @Roles('team_admin')
  async createTlsProbe(@Request() req: SiteAuthRequest, @Param('id') id: string, @Body() dto: CreateSiteTlsProbeDto) {
    await this.assertSiteWrite(req, id, 'site.tls_probe', 'low');
    return this.siteService.createTlsProbe(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/tls-renew')
  @Roles('team_admin')
  async createTlsRenew(@Request() req: SiteAuthRequest, @Param('id') id: string, @Body() dto: CreateSiteTlsRenewDto) {
    await this.assertSiteWrite(req, id, 'site.tls_renew', dto.dryRun === false ? 'medium' : 'low');
    return this.siteService.createTlsRenew(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/sync-runs/:runId/rollback')
  @Roles('team_admin')
  async rollbackSyncRun(@Request() req: SiteAuthRequest, @Param('id') id: string, @Param('runId') runId: string, @Body() dto: RollbackSiteSyncRunDto) {
    await this.assertSiteWrite(req, id, 'site.rollback', dto.dryRun === false ? 'high' : 'medium');
    return this.siteService.rollbackSyncRun(req.teamId, req.user.id, id, runId, dto);
  }

  private async assertSiteWrite(req: SiteAuthRequest, id: string, action: string, risk: string) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.accessPolicy.assertCanWriteSite(req, action, id, site.projectId, site.environmentId, risk);
  }
}
