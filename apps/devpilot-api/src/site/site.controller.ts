import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from '../control-access-policy';
import {
  CreateSiteDto,
  CreateSiteDiagnosticsDto,
  CreateSiteOpenRestyModuleBaselineDto,
  CreateSiteOpenRestyModulesDto,
  CreateSiteOpenRestyStatusDto,
  CreateSiteSmokeCheckDto,
  CreateSiteSyncPlanDto,
  CreateSiteTlsProbeDto,
  CreateSiteTlsRenewDto,
  ListSiteSyncRunsQueryDto,
  ListSitesQueryDto,
  PreviewSiteTakeoverDto,
  RollbackSiteSyncRunDto,
  UpdateSiteDto,
} from './dto/site.dto';
import { SiteService } from './site.service';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type ReadableSiteRecord = {
  id: string;
  projectId?: string | null;
  environmentId?: string | null;
};

@Controller('sites')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class SiteController {
  constructor(
    private readonly siteService: SiteService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Get()
  async listSites(
    @Request() req: AuthRequest,
    @Query() query: ListSitesQueryDto,
  ) {
    const sites = await this.siteService.listSites(req.teamId, query);
    return this.filterReadableSiteRecords(req, sites, 'site.read', 'site');
  }

  @Post()
  async createSite(@Request() req: AuthRequest, @Body() dto: CreateSiteDto) {
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: dto.projectId,
      environmentId: dto.environmentId,
      category: 'site',
      action: 'site.create',
      targetType: 'site',
      risk: 'medium',
    });
    return this.siteService.createSite(req.teamId, req.user.id, dto);
  }

  @Get(':id')
  async getSite(@Request() req: AuthRequest, @Param('id') id: string) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.assertCanReadSite(req, 'site.read', id, site.projectId, site.environmentId, 'site');
    return site;
  }

  @Get(':id/sync-runs')
  async listSyncRuns(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Query() query: ListSiteSyncRunsQueryDto,
  ) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.assertCanReadSite(req, 'site.read', id, site.projectId, site.environmentId, 'site');
    const runs = await this.siteService.listSyncRuns(req.teamId, id, query);
    return this.filterReadableSiteRecords(req, runs, 'site_sync_run.read', 'site_sync_run');
  }

  @Put(':id')
  async updateSite(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateSiteDto,
  ) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.assertCanWriteSite(req, 'site.update', id, site.projectId, site.environmentId, 'medium');
    if (
      (dto.projectId && dto.projectId !== site.projectId) ||
      (dto.environmentId && dto.environmentId !== site.environmentId)
    ) {
      await this.assertCanWriteSite(
        req,
        'site.update',
        id,
        dto.projectId || site.projectId,
        dto.environmentId || site.environmentId,
        'medium',
      );
    }
    return this.siteService.updateSite(req.teamId, id, dto);
  }

  @Delete(':id')
  async deleteSite(@Request() req: AuthRequest, @Param('id') id: string) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.assertCanWriteSite(req, 'site.delete', id, site.projectId, site.environmentId, 'high');
    return this.siteService.deleteSite(req.teamId, id);
  }

  @Post(':id/preview-takeover')
  @Roles('team_admin')
  async takeoverPreviewSite(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: PreviewSiteTakeoverDto,
  ) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.assertCanWriteSite(
      req,
      'site.preview_takeover',
      id,
      site.projectId,
      site.environmentId,
      'medium',
    );
    return this.siteService.takeoverPreviewSite(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/sync-plan')
  @Roles('team_admin')
  async createSyncPlan(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateSiteSyncPlanDto,
  ) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.assertCanWriteSite(
      req,
      'site.sync',
      id,
      site.projectId,
      site.environmentId,
      dto.dryRun === false ? 'medium' : 'low',
    );
    return this.siteService.createSyncPlan(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/diagnostics')
  @Roles('team_admin')
  async createDiagnostics(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateSiteDiagnosticsDto,
  ) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.assertCanWriteSite(
      req,
      'site.diagnostics',
      id,
      site.projectId,
      site.environmentId,
      dto.dryRun === false ? 'medium' : 'low',
    );
    return this.siteService.createDiagnostics(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/openresty-module-baseline')
  @Roles('team_admin')
  async createOpenRestyModuleBaseline(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateSiteOpenRestyModuleBaselineDto,
  ) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.assertCanWriteSite(
      req,
      'site.openresty_module_baseline',
      id,
      site.projectId,
      site.environmentId,
      'low',
    );
    return this.siteService.createOpenRestyModuleBaseline(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/openresty-modules')
  @Roles('team_admin')
  async createOpenRestyModules(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateSiteOpenRestyModulesDto,
  ) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.assertCanWriteSite(
      req,
      'site.openresty_modules',
      id,
      site.projectId,
      site.environmentId,
      'low',
    );
    return this.siteService.createOpenRestyModules(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/openresty-status')
  @Roles('team_admin')
  async createOpenRestyStatus(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateSiteOpenRestyStatusDto,
  ) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.assertCanWriteSite(
      req,
      'site.openresty_status',
      id,
      site.projectId,
      site.environmentId,
      'low',
    );
    return this.siteService.createOpenRestyStatus(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/smoke-check')
  @Roles('team_admin')
  async createSmokeCheck(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateSiteSmokeCheckDto,
  ) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.assertCanWriteSite(
      req,
      'site.smoke_check',
      id,
      site.projectId,
      site.environmentId,
      'low',
    );
    return this.siteService.createSmokeCheck(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/tls-probe')
  @Roles('team_admin')
  async createTlsProbe(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateSiteTlsProbeDto,
  ) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.assertCanWriteSite(
      req,
      'site.tls_probe',
      id,
      site.projectId,
      site.environmentId,
      'low',
    );
    return this.siteService.createTlsProbe(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/tls-renew')
  @Roles('team_admin')
  async createTlsRenew(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateSiteTlsRenewDto,
  ) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.assertCanWriteSite(
      req,
      'site.tls_renew',
      id,
      site.projectId,
      site.environmentId,
      dto.dryRun === false ? 'medium' : 'low',
    );
    return this.siteService.createTlsRenew(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/sync-runs/:runId/rollback')
  @Roles('team_admin')
  async rollbackSyncRun(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Param('runId') runId: string,
    @Body() dto: RollbackSiteSyncRunDto,
  ) {
    const site = await this.siteService.getSite(req.teamId, id);
    await this.assertCanWriteSite(
      req,
      'site.rollback',
      id,
      site.projectId,
      site.environmentId,
      dto.dryRun === false ? 'high' : 'medium',
    );
    return this.siteService.rollbackSyncRun(req.teamId, req.user.id, id, runId, dto);
  }

  private assertCanWriteSite(
    req: AuthRequest,
    action: string,
    siteId: string,
    projectId?: string | null,
    environmentId?: string | null,
    risk: string = 'medium',
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'site',
      action,
      targetType: 'site',
      targetId: siteId,
      risk,
    });
  }

  private assertCanReadSite(
    req: AuthRequest,
    action: string,
    siteId: string | null,
    projectId?: string | null,
    environmentId?: string | null,
    targetType: string = 'site',
  ) {
    return this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'site',
      action,
      targetType,
      targetId: siteId,
      risk: 'low',
    });
  }

  private async filterReadableSiteRecords<T extends ReadableSiteRecord>(
    req: AuthRequest,
    records: T[],
    action: string,
    targetType: string,
  ) {
    const allowed = await Promise.all(records.map(async (record) => ({
      record,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: record.projectId,
        environmentId: record.environmentId,
        category: 'site',
        action,
        targetType,
        targetId: record.id,
        risk: 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.record);
  }
}
