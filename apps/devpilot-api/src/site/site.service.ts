import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { OperationApprovalService } from '../operation-approval';
import { PrismaService } from '../prisma/prisma.service';
import { ServerCommandStep, ServerExecutionResult, ServerExecutorService } from '../server-executor';
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
  SiteRuntimeType,
  UpdateSiteDto,
} from './dto/site.dto';
import {
  buildSiteTlsProbeCommand,
  extractSiteTlsProbeMetadata,
  mergeSiteTlsProbeMetadata,
} from './site-tls-probe';
import {
  extractSiteTlsRenewMetadata,
  mergeSiteTlsRenewFollowUpProbeMetadata,
  mergeSiteTlsRenewMetadata,
} from './site-tls-renew';
import {
  isRecord,
  readString,
  readBoolean,
  readStringArray,
  type JsonRecord,
  type SiteConfigDiff,
  type SiteOperationAction,
  type SiteOperationKey,
  type SiteOperationMode,
  type SiteOperationTrigger,
  type SiteSyncExecutionPlan,
} from './site-plan.types';
import {
  modeForAction,
  mutatesNginxConfig,
  mutatesSiteStatus,
  requiresExecutionConfirmation,
  requiresSiteOperationApproval,
  siteOperationLabel,
} from './site-operation-policy.utils';
import {
  buildConfigDiffFromBaseline,
  buildNoConfigDiff,
} from './site-config-diff.utils';
import {
  buildApprovalBlockedExecution,
  buildSiteApprovalContext,
  buildSiteSyncAuditInput,
} from './site-sync-approval.utils';
import { SITE_INCLUDE, SYNC_RUN_INCLUDE } from './site-includes.utils';
import { SitePostSyncUpdateService } from './site-post-sync-update.service';
import { SiteSyncExecutionService, type SiteOperationExecutionResult } from './site-sync-execution.service';
import { validateTakeoverInput, buildTakeoverRuntimeConfig } from './site-takeover-preview.utils';
import {
  buildCertificateCommand,
  buildCertificateRenewCommand,
  filenameForDomain,
  generateNginxConfig,
  isPreviewSitePlaceholder,
  isSafeDomain,
  isSafeNginxPath,
  isSafeNginxSiteConfigPath,
  isSafeProbeHostname,
  isSafeUpstream,
  resolveCertificateName,
  resolveUpstream,
} from './site-config-gen.utils';
import {
  buildDiagnosticsPlan,
  buildRollbackPlan,
  buildSyncPlan,
} from './site-sync-plan.utils';
import {
  buildOpenRestyModuleBaselinePlan,
  buildOpenRestyModulesPlan,
  buildOpenRestyStatusPlan,
} from './site-openresty-plan.utils';
import {
  buildSmokeCheckPlan,
  buildTlsProbePlan,
  buildTlsRenewPlan,
} from './site-ops-plan.utils';

type SiteRecord = Awaited<ReturnType<SiteService['getSite']>>;

@Injectable()
export class SiteService {
  private readonly logger = new Logger(SiteService.name);

  private readonly executionService: SiteSyncExecutionService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly serverExecutor: ServerExecutorService,
    private readonly auditEventService: AuditEventService,
    private readonly operationApprovalService: OperationApprovalService,
    private readonly postSyncUpdateService: SitePostSyncUpdateService,
  ) {
    // Build the execution service internally so it reuses the same injected deps
    // (no separate mock needed in specs). Breaks the circular dependency: the
    // host's createTlsProbe is wired into the post-sync service via callback.
    this.executionService = new SiteSyncExecutionService(
      prisma,
      serverExecutor,
      operationApprovalService,
      postSyncUpdateService,
      auditEventService,
    );
    this.postSyncUpdateService.setCreateTlsProbeCallback(
      (teamId, userId, siteId, dto, trigger, sourceRunId) =>
        this.createTlsProbe(teamId, userId, siteId, dto, trigger, sourceRunId),
    );
  }

  async listSites(teamId: string, query: ListSitesQueryDto) {
    const where: Prisma.SiteWhereInput = { teamId };

    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.environmentId) {
      where.environmentId = query.environmentId;
    }
    if (query.serverId) {
      where.serverId = query.serverId;
    }
    if (query.status) {
      where.status = query.status;
    }

    return this.prisma.site.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: SITE_INCLUDE,
    });
  }

  async createSite(teamId: string, userId: string, dto: CreateSiteDto) {
    await this.assertBindings(teamId, dto);

    return this.prisma.site.create({
      data: {
        teamId,
        createdById: userId,
        name: dto.name,
        primaryDomain: dto.primaryDomain,
        aliases: dto.aliases ? this.toJsonValue(this.cleanAliases(dto.aliases)) : undefined,
        runtimeType: dto.runtimeType || 'reverse_proxy',
        runtimeConfig: dto.runtimeConfig ? this.toJsonValue(dto.runtimeConfig) : undefined,
        tls: dto.tls ? this.toJsonValue(dto.tls) : undefined,
        accessPolicy: dto.accessPolicy ? this.toJsonValue(dto.accessPolicy) : undefined,
        projectId: dto.projectId,
        environmentId: dto.environmentId,
        serverId: dto.serverId,
        proxyConfigId: dto.proxyConfigId,
        status: 'draft',
      },
      include: SITE_INCLUDE,
    });
  }

  async getSite(teamId: string, id: string) {
    const site = await this.prisma.site.findFirst({
      where: { id, teamId },
      include: SITE_INCLUDE,
    });

    if (!site) {
      throw new NotFoundException('站点不存在');
    }

    return site;
  }

  async listSyncRuns(teamId: string, id: string, query: ListSiteSyncRunsQueryDto) {
    await this.getSite(teamId, id);

    const where: Prisma.SiteSyncRunWhereInput = { teamId, siteId: id };
    if (query.mode) where.mode = query.mode;
    if (query.status) where.status = query.status;

    return this.prisma.siteSyncRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 20,
      include: SYNC_RUN_INCLUDE,
    });
  }

  async updateSite(teamId: string, id: string, dto: UpdateSiteDto) {
    const existing = await this.getSite(teamId, id);
    await this.assertBindings(teamId, dto, existing.projectId);

    const data: Prisma.SiteUncheckedUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.primaryDomain !== undefined) data.primaryDomain = dto.primaryDomain;
    if (dto.aliases !== undefined) data.aliases = this.toJsonValue(this.cleanAliases(dto.aliases));
    if (dto.runtimeType !== undefined) data.runtimeType = dto.runtimeType;
    if (dto.runtimeConfig !== undefined) data.runtimeConfig = this.toJsonValue(dto.runtimeConfig);
    if (dto.tls !== undefined) data.tls = this.toJsonValue(dto.tls);
    if (dto.accessPolicy !== undefined) data.accessPolicy = this.toJsonValue(dto.accessPolicy);
    if (dto.projectId !== undefined) data.projectId = dto.projectId || null;
    if (dto.environmentId !== undefined) data.environmentId = dto.environmentId || null;
    if (dto.serverId !== undefined) data.serverId = dto.serverId || null;
    if (dto.proxyConfigId !== undefined) data.proxyConfigId = dto.proxyConfigId || null;
    data.status = dto.status || 'pending';

    return this.prisma.site.update({
      where: { id },
      data,
      include: SITE_INCLUDE,
    });
  }

  async takeoverPreviewSite(teamId: string, userId: string, id: string, dto: PreviewSiteTakeoverDto) {
    const existing = await this.getSite(teamId, id);
    const { serverId, upstreamUrl, preview } = validateTakeoverInput(dto, existing.runtimeConfig);
    await this.assertBindings(teamId, { serverId });
    const nextRuntimeConfig = buildTakeoverRuntimeConfig(existing.runtimeConfig, preview, upstreamUrl, userId, dto.websocket);

    const data: Prisma.SiteUncheckedUpdateInput = {
      serverId, runtimeType: 'reverse_proxy', runtimeConfig: this.toJsonValue(nextRuntimeConfig), status: 'pending', syncError: null,
    };
    if (dto.tls !== undefined) data.tls = this.toJsonValue(dto.tls);
    if (dto.accessPolicy !== undefined) data.accessPolicy = this.toJsonValue(dto.accessPolicy);

    const site = await this.prisma.site.update({ where: { id }, data, include: SITE_INCLUDE });
    const syncPlan = dto.createDryRunPlan === false
      ? null
      : await this.createSyncPlan(teamId, userId, id, { dryRun: true, queue: dto.queue, maxAttempts: dto.maxAttempts });
    return { site, syncPlan };
  }

  async deleteSite(teamId: string, id: string) {
    await this.getSite(teamId, id);
    await this.prisma.site.delete({ where: { id } });
    return { success: true };
  }

  async createSyncPlan(teamId: string, userId: string, id: string, dto: CreateSiteSyncPlanDto) {
    const site = await this.getSite(teamId, id);
    const plan = buildSyncPlan(site);
    const dryRun = dto.dryRun !== false;

    return this.executionService.execute(teamId, userId, site, plan, {
      action: 'site.sync',
      operationKey: 'site.sync',
      mode: 'sync',
      trigger: 'manual',
      dryRun,
      queue: dto.queue,
      maxAttempts: dto.maxAttempts,
      confirmationText: dto.confirmationText,
      approvalId: dto.approvalId,
      approvalReason: dto.approvalReason,
    });
  }

  async createDiagnostics(teamId: string, userId: string, id: string, dto: CreateSiteDiagnosticsDto) {
    const site = await this.getSite(teamId, id);
    const plan = buildDiagnosticsPlan(site, dto.tailLines);
    const dryRun = dto.dryRun === true;

    return this.executionService.execute(teamId, userId, site, plan, {
      action: 'site.diagnostics',
      operationKey: 'site.diagnostics',
      mode: 'diagnostics',
      trigger: 'manual_diagnostics',
      dryRun,
      queue: dto.queue,
      maxAttempts: dto.maxAttempts,
    });
  }

  async createOpenRestyStatus(teamId: string, userId: string, id: string, dto: CreateSiteOpenRestyStatusDto) {
    const site = await this.getSite(teamId, id);
    const plan = buildOpenRestyStatusPlan(site);
    const dryRun = dto.dryRun === true;

    return this.executionService.execute(teamId, userId, site, plan, {
      action: 'site.openresty_status',
      operationKey: 'site.openresty_status',
      mode: 'openresty_status',
      trigger: 'manual_openresty_status',
      dryRun,
      queue: dto.queue,
      maxAttempts: dto.maxAttempts,
    });
  }

  async createOpenRestyModules(teamId: string, userId: string, id: string, dto: CreateSiteOpenRestyModulesDto) {
    const site = await this.getSite(teamId, id);
    const plan = buildOpenRestyModulesPlan(site);
    const dryRun = dto.dryRun === true;

    return this.executionService.execute(teamId, userId, site, plan, {
      action: 'site.openresty_modules',
      operationKey: 'site.openresty_modules',
      mode: 'openresty_modules',
      trigger: 'manual_openresty_modules',
      dryRun,
      queue: dto.queue,
      maxAttempts: dto.maxAttempts,
    });
  }

  async createOpenRestyModuleBaseline(
    teamId: string,
    userId: string,
    id: string,
    dto: CreateSiteOpenRestyModuleBaselineDto,
  ) {
    const site = await this.getSite(teamId, id);
    const plan = buildOpenRestyModuleBaselinePlan(site);
    const dryRun = dto.dryRun === true;

    return this.executionService.execute(teamId, userId, site, plan, {
      action: 'site.openresty_module_baseline',
      operationKey: 'site.openresty_module_baseline',
      mode: 'openresty_module_baseline',
      trigger: 'manual_openresty_module_baseline',
      dryRun,
      queue: dto.queue,
      maxAttempts: dto.maxAttempts,
    });
  }

  async createSmokeCheck(teamId: string, userId: string, id: string, dto: CreateSiteSmokeCheckDto) {
    const site = await this.getSite(teamId, id);
    const plan = buildSmokeCheckPlan(site);
    const dryRun = dto.dryRun === true;

    return this.executionService.execute(teamId, userId, site, plan, {
      action: 'site.smoke_check',
      operationKey: 'site.smoke_check',
      mode: 'smoke_check',
      trigger: 'manual_smoke_check',
      dryRun,
      queue: dto.queue,
      maxAttempts: dto.maxAttempts,
    });
  }

  async createTlsProbe(
    teamId: string,
    userId: string | null,
    id: string,
    dto: CreateSiteTlsProbeDto,
    trigger: SiteOperationTrigger = 'manual_tls_probe',
    sourceRunId?: string | null,
  ): Promise<SiteOperationExecutionResult> {
    const site = await this.getSite(teamId, id);
    const plan = buildTlsProbePlan(site);
    const dryRun = dto.dryRun === true;

    return this.executionService.execute(teamId, userId, site, plan, {
      action: 'site.tls_probe',
      operationKey: 'site.tls_probe',
      mode: 'tls_probe',
      trigger,
      dryRun,
      queue: dto.queue,
      maxAttempts: dto.maxAttempts,
      sourceRunId,
    });
  }

  async createTlsRenew(
    teamId: string,
    userId: string | null,
    id: string,
    dto: CreateSiteTlsRenewDto,
    trigger: SiteOperationTrigger = 'manual_tls_renew',
  ) {
    const site = await this.getSite(teamId, id);
    const dryRun = dto.dryRun !== false;
    const plan = buildTlsRenewPlan(site, dryRun);

    return this.executionService.execute(teamId, userId, site, plan, {
      action: 'site.tls_renew',
      operationKey: 'site.tls_renew',
      mode: 'tls_renew',
      trigger,
      dryRun,
      queue: dto.queue,
      maxAttempts: dto.maxAttempts,
      confirmationText: dto.confirmationText,
      approvalId: dto.approvalId,
      approvalReason: dto.approvalReason,
    });
  }

  async rollbackSyncRun(
    teamId: string,
    userId: string,
    id: string,
    runId: string,
    dto: RollbackSiteSyncRunDto,
  ) {
    const site = await this.getSite(teamId, id);
    const sourceRun = await this.prisma.siteSyncRun.findFirst({
      where: { id: runId, teamId, siteId: id },
      include: SYNC_RUN_INCLUDE,
    });

    if (!sourceRun) {
      throw new NotFoundException('站点同步运行记录不存在');
    }
    if (sourceRun.status !== 'completed' || sourceRun.dryRun) {
      throw new BadRequestException('只能回滚到已成功执行的非 dry-run 同步记录');
    }
    if (!sourceRun.nginxConfig.trim()) {
      throw new BadRequestException('历史同步记录缺少 Nginx 配置快照，无法回滚');
    }

    const dryRun = dto.dryRun !== false;
    const plan = buildRollbackPlan(site, sourceRun.nginxConfig, sourceRun.targetConfigPath);

    return this.executionService.execute(teamId, userId, site, plan, {
      action: 'site.rollback',
      operationKey: 'site.rollback',
      mode: 'rollback',
      trigger: 'manual_rollback',
      dryRun,
      queue: dto.queue,
      maxAttempts: dto.maxAttempts,
      confirmationText: dto.confirmationText,
      approvalId: dto.approvalId,
      approvalReason: dto.approvalReason,
      sourceRunId: sourceRun.id,
      sourceRun,
    });
  }

  private async assertBindings(
    teamId: string,
    dto: Pick<CreateSiteDto, 'projectId' | 'environmentId' | 'serverId' | 'proxyConfigId'>,
    fallbackProjectId?: string | null,
  ) {
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, teamId },
        select: { id: true },
      });
      if (!project) throw new BadRequestException('项目不存在或不属于当前团队');
    }

    if (dto.serverId) {
      const server = await this.prisma.server.findFirst({
        where: { id: dto.serverId, teamId },
        select: { id: true },
      });
      if (!server) throw new BadRequestException('服务器不存在或不属于当前团队');
    }

    if (dto.environmentId) {
      const projectId = dto.projectId || fallbackProjectId;
      if (!projectId) {
        throw new BadRequestException('绑定项目环境前需要先关联项目');
      }

      const environment = await this.prisma.projectEnvironment.findFirst({
        where: {
          id: dto.environmentId,
          teamId,
          projectId,
          status: 'active',
        },
        select: { id: true },
      });
      if (!environment) throw new BadRequestException('项目环境不存在或不属于当前项目');
    }

    if (dto.proxyConfigId) {
      const proxyConfig = await this.prisma.proxyConfig.findFirst({
        where: { id: dto.proxyConfigId, teamId },
        select: { id: true },
      });
      if (!proxyConfig) throw new BadRequestException('代理配置不存在或不属于当前团队');
    }
  }


  private cleanAliases(aliases: string[]) {
    return aliases.map((alias) => alias.trim()).filter(Boolean);
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    return typeof error === 'string' ? error : '站点同步执行异常';
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
