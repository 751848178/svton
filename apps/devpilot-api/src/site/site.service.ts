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
  type SiteSyncExecutionPlan,
} from './site-plan.types';
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
type SiteConfigDiff = {
  sourceRunId?: string | null;
  hasBaseline: boolean;
  hasChanges: boolean;
  added: number;
  removed: number;
  unchanged: number;
  summary: string;
  unifiedDiff: string;
};
type SiteOperationAction =
  | 'site.sync'
  | 'site.rollback'
  | 'site.diagnostics'
  | 'site.openresty_module_baseline'
  | 'site.openresty_modules'
  | 'site.openresty_status'
  | 'site.smoke_check'
  | 'site.tls_probe'
  | 'site.tls_renew';
type SiteOperationKey =
  | 'site.sync'
  | 'site.rollback'
  | 'site.diagnostics'
  | 'site.openresty_module_baseline'
  | 'site.openresty_modules'
  | 'site.openresty_status'
  | 'site.smoke_check'
  | 'site.tls_probe'
  | 'site.tls_renew';
type SiteOperationMode =
  | 'sync'
  | 'rollback'
  | 'diagnostics'
  | 'openresty_module_baseline'
  | 'openresty_modules'
  | 'openresty_status'
  | 'smoke_check'
  | 'tls_probe'
  | 'tls_renew';
type SiteOperationTrigger =
  | 'manual'
  | 'manual_rollback'
  | 'manual_diagnostics'
  | 'manual_openresty_module_baseline'
  | 'manual_openresty_modules'
  | 'manual_openresty_status'
  | 'manual_smoke_check'
  | 'manual_tls_probe'
  | 'manual_tls_renew'
  | 'scheduled_tls_probe'
  | 'scheduled_tls_renew'
  | 'renewal_follow_up_tls_probe';
type SiteSyncRunSummary = {
  id: string;
  operationApprovalId?: string | null;
  serverExecutionJobId?: string | null;
  configDiff?: Prisma.JsonValue | null;
} & Record<string, unknown>;
type SiteOperationExecutionResult = {
  mode: string;
  status: ServerExecutionResult['status'];
  executorKey: string;
  adapterKey: string;
  executable: boolean;
  warnings: string[];
  commandPlan: ServerCommandStep[];
  executionPlan: Prisma.InputJsonValue;
  logs: Prisma.InputJsonValue;
  result: Prisma.InputJsonValue;
  error?: string;
  nginxConfig: string;
  configDiff: SiteConfigDiff;
  target: SiteSyncExecutionPlan['target'];
  syncRun: SiteSyncRunSummary;
  approval?: unknown;
  sourceRun?: unknown;
  site: SiteRecord;
};

@Injectable()
export class SiteService {
  private readonly logger = new Logger(SiteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly serverExecutor: ServerExecutorService,
    private readonly auditEventService: AuditEventService,
    private readonly operationApprovalService: OperationApprovalService,
  ) {}

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
      include: this.siteInclude(),
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
      include: this.siteInclude(),
    });
  }

  async getSite(teamId: string, id: string) {
    const site = await this.prisma.site.findFirst({
      where: { id, teamId },
      include: this.siteInclude(),
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
      include: this.syncRunInclude(),
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
      include: this.siteInclude(),
    });
  }

  async takeoverPreviewSite(teamId: string, userId: string, id: string, dto: PreviewSiteTakeoverDto) {
    const existing = await this.getSite(teamId, id);
    const runtimeConfig = isRecord(existing.runtimeConfig) ? { ...existing.runtimeConfig } : {};
    const preview = isRecord(runtimeConfig.preview) ? { ...runtimeConfig.preview } : {};

    if (!isPreviewSitePlaceholder(runtimeConfig)) {
      throw new BadRequestException('只有 PR Preview draft Site 占位可以执行预览接管');
    }
    if (readString(preview.status) === 'archived' || readBoolean(preview.enabled) === false) {
      throw new BadRequestException('已归档的 PR Preview Site 不能执行预览接管');
    }

    const serverId = dto.serverId.trim();
    const upstreamUrl = dto.upstreamUrl.trim();
    if (!serverId) {
      throw new BadRequestException('预览站点接管需要绑定目标服务器');
    }
    if (!upstreamUrl) {
      throw new BadRequestException('预览站点接管需要提供上游地址');
    }
    if (!isSafeUpstream(upstreamUrl)) {
      throw new BadRequestException('上游地址必须是安全的 http/https upstream，且不能包含空白或 shell/nginx 注入字符');
    }

    await this.assertBindings(teamId, { serverId });

    const now = new Date().toISOString();
    const nextPreview: Record<string, unknown> = {
      ...preview,
      status: 'ready_for_sync',
      syncBlocked: false,
      activatedAt: now,
      activatedById: userId,
      upstreamUrl,
    };
    delete nextPreview.syncBlockedReason;

    const nextRuntimeConfig: Record<string, unknown> = {
      ...runtimeConfig,
      placeholder: false,
      syncBlocked: false,
      upstreamUrl,
      websocket: dto.websocket ?? readBoolean(runtimeConfig.websocket) === true,
      preview: nextPreview,
    };
    delete nextRuntimeConfig.syncBlockedReason;

    const data: Prisma.SiteUncheckedUpdateInput = {
      serverId,
      runtimeType: 'reverse_proxy',
      runtimeConfig: this.toJsonValue(nextRuntimeConfig),
      status: 'pending',
      syncError: null,
    };

    if (dto.tls !== undefined) {
      data.tls = this.toJsonValue(dto.tls);
    }
    if (dto.accessPolicy !== undefined) {
      data.accessPolicy = this.toJsonValue(dto.accessPolicy);
    }

    const site = await this.prisma.site.update({
      where: { id },
      data,
      include: this.siteInclude(),
    });
    const syncPlan = dto.createDryRunPlan === false
      ? null
      : await this.createSyncPlan(teamId, userId, id, {
          dryRun: true,
          queue: dto.queue,
          maxAttempts: dto.maxAttempts,
        });

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

    return this.executeSiteSyncOperation(teamId, userId, site, plan, {
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

    return this.executeSiteSyncOperation(teamId, userId, site, plan, {
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

    return this.executeSiteSyncOperation(teamId, userId, site, plan, {
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

    return this.executeSiteSyncOperation(teamId, userId, site, plan, {
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

    return this.executeSiteSyncOperation(teamId, userId, site, plan, {
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

    return this.executeSiteSyncOperation(teamId, userId, site, plan, {
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

    return this.executeSiteSyncOperation(teamId, userId, site, plan, {
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

    return this.executeSiteSyncOperation(teamId, userId, site, plan, {
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
      include: this.syncRunInclude(),
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

    return this.executeSiteSyncOperation(teamId, userId, site, plan, {
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

  private async executeSiteSyncOperation(
    teamId: string,
    userId: string | null,
    site: SiteRecord,
    plan: SiteSyncExecutionPlan,
    options: {
      action: SiteOperationAction;
      operationKey: SiteOperationKey;
      mode: SiteOperationMode;
      trigger: SiteOperationTrigger;
      dryRun: boolean;
      queue?: boolean;
      maxAttempts?: number;
      confirmationText?: string;
      approvalId?: string;
      approvalReason?: string;
      sourceRunId?: string | null;
      sourceRun?: unknown;
    },
  ): Promise<SiteOperationExecutionResult> {
    const target = await this.serverExecutor.resolveTarget(teamId, site.serverId);
    const configDiff = this.mutatesNginxConfig(options.mode)
      ? await this.buildConfigDiff(teamId, site.id, plan.nginxConfig, options.sourceRunId)
      : this.buildNoConfigDiff(`${this.siteOperationLabel(options.action)}不变更 Nginx 配置`);
    const approvalContext = this.buildSiteApprovalContext(
      teamId,
      userId,
      site,
      plan,
      options,
      configDiff,
    );
    const requiresApproval = this.requiresSiteOperationApproval(options.action, options.dryRun);
    const approvedApproval = requiresApproval
      ? await this.operationApprovalService.resolveApproved({
          ...approvalContext,
          approvalId: options.approvalId,
        })
      : null;
    const run = await this.prisma.siteSyncRun.create({
      data: {
        teamId,
        actorId: userId ?? undefined,
        siteId: site.id,
        projectId: site.projectId,
        environmentId: site.environmentId,
        serverId: site.serverId,
        sourceRunId: options.sourceRunId ?? undefined,
        operationApprovalId: approvedApproval?.id,
        mode: options.mode,
        trigger: options.trigger,
        executorKey: 'server-executor',
        adapterKey: 'nginx-site-plan',
        dryRun: options.dryRun,
        status: options.queue ? 'queued' : 'running',
        targetConfigPath: plan.target.configPath,
        nginxConfig: plan.nginxConfig,
        commandPlan: this.toJsonValue(plan.commandPlan),
        configDiff: this.toJsonValue(configDiff),
        warnings: this.toJsonValue(plan.warnings),
      },
      include: this.syncRunInclude(),
    });

    let execution: ServerExecutionResult;
    try {
      if (requiresApproval && !approvedApproval) {
        const approval = await this.operationApprovalService.createPending({
          ...approvalContext,
          reusePending: false,
          metadata: {
            ...approvalContext.metadata,
            siteSyncRunId: run.id,
            sourceRunId: options.sourceRunId,
            configDiff,
          },
        });
        const blockedRun = await this.prisma.siteSyncRun.update({
          where: { id: run.id },
          data: {
            status: 'blocked',
            operationApprovalId: approval.id,
            error: '非 dry-run 的站点操作需要审批',
            finishedAt: new Date(),
            result: this.toJsonValue({
              mode: 'blocked_operation_approval',
              approvalId: approval.id,
              approvalStatus: approval.status,
            }),
          },
          include: this.syncRunInclude(),
        });
        const blockedExecution = this.buildApprovalBlockedExecution(plan, approval.id);
        await this.writeSiteSyncAudit(
          teamId,
          userId,
          site,
          blockedExecution,
          options.dryRun,
          plan,
          blockedRun,
          options.action,
        );

        return {
          mode: blockedExecution.mode,
          status: blockedExecution.status,
          executorKey: blockedExecution.executorKey,
          adapterKey: blockedExecution.adapterKey,
          executable: blockedExecution.executable,
          warnings: blockedExecution.warnings,
          commandPlan: blockedExecution.commandSteps,
          executionPlan: blockedExecution.commandPlan,
          logs: blockedExecution.logs,
          result: blockedExecution.result,
          error: blockedExecution.error,
          nginxConfig: plan.nginxConfig,
          configDiff,
          target: plan.target,
          syncRun: blockedRun,
          approval,
          sourceRun: options.sourceRun,
          site,
        };
      }

      const executionInput = {
        teamId,
        userId: userId ?? undefined,
        operationKey: options.operationKey,
        adapterKey: 'nginx-site-plan',
        dryRun: options.dryRun,
        target,
        steps: plan.commandPlan,
        warnings: plan.warnings,
        metadata: {
          siteId: site.id,
          siteSyncRunId: run.id,
          projectId: site.projectId,
          environmentId: site.environmentId,
          siteName: site.name,
          primaryDomain: site.primaryDomain,
          runtimeType: site.runtimeType,
          configPath: plan.target.configPath,
          tlsProbeHost: options.mode === 'tls_probe' ? site.primaryDomain : undefined,
          tlsProbePort: options.mode === 'tls_probe' ? 443 : undefined,
          tlsType: options.mode === 'tls_probe' && isRecord(site.tls)
            ? readString(site.tls.type)
            : undefined,
          mode: options.mode,
          trigger: options.trigger,
          sourceRunId: options.sourceRunId,
          operationApprovalId: approvedApproval?.id,
          businessRunSync: options.queue ? 'site_sync' : undefined,
        },
        blockOnWarnings: !options.dryRun,
        requiredConfirmationText: this.requiresExecutionConfirmation(options.action) ? site.name : undefined,
        confirmationText: options.confirmationText,
      };

      if (options.queue) {
        const queuedExecution = await this.serverExecutor.queueExecution(executionInput, {
          maxAttempts: options.maxAttempts,
        });
        const queuedRun = await this.prisma.siteSyncRun.update({
          where: { id: run.id },
          data: {
            status: queuedExecution.status,
            serverExecutionJobId: queuedExecution.serverExecutionJobId,
            executorKey: queuedExecution.executorKey,
            adapterKey: queuedExecution.adapterKey,
            commandPlan: this.toJsonValue(queuedExecution.commandSteps),
            configDiff: this.toJsonValue(configDiff),
            executionPlan: queuedExecution.commandPlan,
            logs: queuedExecution.logs,
            result: queuedExecution.result,
            warnings: this.toJsonValue(queuedExecution.warnings),
            error: queuedExecution.error ?? null,
          },
          include: this.syncRunInclude(),
        });
        await this.writeSiteSyncAudit(
          teamId,
          userId,
          site,
          queuedExecution,
          options.dryRun,
          plan,
          queuedRun,
          options.action,
        );
        if (approvedApproval && queuedRun.status !== 'blocked') {
          await this.operationApprovalService.consume(teamId, approvedApproval.id);
        }

        return {
          mode: queuedExecution.mode,
          status: queuedExecution.status,
          executorKey: queuedExecution.executorKey,
          adapterKey: queuedExecution.adapterKey,
          executable: queuedExecution.executable,
          warnings: queuedExecution.warnings,
          commandPlan: queuedExecution.commandSteps,
          executionPlan: queuedExecution.commandPlan,
          logs: queuedExecution.logs,
          result: queuedExecution.result,
          error: queuedExecution.error,
          nginxConfig: plan.nginxConfig,
          configDiff,
          target: plan.target,
          syncRun: queuedRun,
          sourceRun: options.sourceRun,
          site,
        };
      }

      execution = await this.serverExecutor.execute(executionInput);
    } catch (error) {
      await this.prisma.siteSyncRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          error: this.errorMessage(error),
          finishedAt: new Date(),
        },
      });
      throw error;
    }

    const shouldUpdateSite = !options.dryRun && this.mutatesSiteStatus(options.mode);
    const syncedSite = shouldUpdateSite
      ? await this.updateSiteAfterSync(site.id, execution.status, execution.error)
      : await this.updateSiteAfterNonMutatingOperation(
          teamId,
          userId,
          site,
          execution,
          options.dryRun,
          options.mode,
          run.id,
        );
    const syncRun = await this.prisma.siteSyncRun.update({
      where: { id: run.id },
      data: {
        status: execution.status,
        executorKey: execution.executorKey,
        adapterKey: execution.adapterKey,
        commandPlan: this.toJsonValue(execution.commandSteps),
        configDiff: this.toJsonValue(configDiff),
        executionPlan: execution.commandPlan,
        logs: execution.logs,
        result: execution.result,
        warnings: this.toJsonValue(execution.warnings),
        error: execution.error ?? null,
        finishedAt: new Date(),
      },
      include: this.syncRunInclude(),
    });
    await this.writeSiteSyncAudit(
      teamId,
      userId,
      syncedSite,
      execution,
      options.dryRun,
      plan,
      syncRun,
      options.action,
    );
    if (approvedApproval && syncRun.status !== 'blocked') {
      await this.operationApprovalService.consume(teamId, approvedApproval.id);
    }

    return {
      mode: execution.mode,
      status: execution.status,
      executorKey: execution.executorKey,
      adapterKey: execution.adapterKey,
      executable: execution.executable,
      warnings: execution.warnings,
      commandPlan: execution.commandSteps,
      executionPlan: execution.commandPlan,
      logs: execution.logs,
      result: execution.result,
      error: execution.error,
      nginxConfig: plan.nginxConfig,
      configDiff,
      target: plan.target,
      syncRun,
      sourceRun: options.sourceRun,
      site: syncedSite,
    };
  }

  private async updateSiteAfterSync(
    siteId: string,
    status: ServerExecutionResult['status'],
    error?: string,
  ) {
    return this.prisma.site.update({
      where: { id: siteId },
      data: {
        status: status === 'completed' ? 'active' : 'error',
        lastSyncAt: new Date(),
        syncError: status === 'completed' ? null : error || '站点同步执行未完成',
      },
      include: this.siteInclude(),
    });
  }

  private async updateSiteTlsAfterProbe(
    site: SiteRecord,
    execution: ServerExecutionResult,
    dryRun: boolean,
    mode: SiteOperationMode,
  ) {
    if (dryRun || mode !== 'tls_probe' || execution.status !== 'completed') {
      return site;
    }

    const tls = isRecord(site.tls) ? site.tls : {};
    const metadata = extractSiteTlsProbeMetadata({
      host: site.primaryDomain,
      port: 443,
      result: execution.result,
      logs: execution.logs,
      currentType: readString(tls.type),
    });

    if (!metadata) {
      return site;
    }

    return this.prisma.site.update({
      where: { id: site.id },
      data: {
        tls: mergeSiteTlsProbeMetadata(site.tls, metadata),
      },
      include: this.siteInclude(),
    });
  }

  private async updateSiteAfterNonMutatingOperation(
    teamId: string,
    userId: string | null,
    site: SiteRecord,
    execution: ServerExecutionResult,
    dryRun: boolean,
    mode: SiteOperationMode,
    runId: string,
  ): Promise<SiteRecord> {
    if (mode === 'tls_probe') {
      return this.updateSiteTlsAfterProbe(site, execution, dryRun, mode);
    }
    if (mode === 'tls_renew') {
      return this.updateSiteTlsAfterRenew(teamId, userId, site, execution, dryRun, runId);
    }

    return site;
  }

  private async updateSiteTlsAfterRenew(
    teamId: string,
    userId: string | null,
    site: SiteRecord,
    execution: ServerExecutionResult,
    dryRun: boolean,
    runId: string,
  ): Promise<SiteRecord> {
    if (execution.status !== 'completed' && execution.status !== 'failed') {
      return site;
    }

    const metadata = extractSiteTlsRenewMetadata({
      result: execution.result,
      logs: execution.logs,
      executionStatus: execution.status,
      dryRun,
      runId,
    });

    const renewedSite = await this.prisma.site.update({
      where: { id: site.id },
      data: {
        tls: mergeSiteTlsRenewMetadata(site.tls, metadata),
      },
      include: this.siteInclude(),
    });

    if (!dryRun && execution.status === 'completed' && metadata.succeeded) {
      return this.queueTlsProbeAfterRenewal(teamId, userId, renewedSite, runId);
    }

    return renewedSite;
  }

  private async queueTlsProbeAfterRenewal(
    teamId: string,
    userId: string | null,
    site: SiteRecord,
    sourceRenewalRunId: string,
  ): Promise<SiteRecord> {
    try {
      const probe: SiteOperationExecutionResult = await this.createTlsProbe(
        teamId,
        userId,
        site.id,
        {
          dryRun: false,
          queue: true,
          maxAttempts: 1,
        },
        'renewal_follow_up_tls_probe',
        sourceRenewalRunId,
      );
      const syncRun = probe.syncRun;
      const queuedAt = new Date().toISOString();

      return this.prisma.site.update({
        where: { id: site.id },
        data: {
          tls: mergeSiteTlsRenewFollowUpProbeMetadata(site.tls, {
            status: 'queued',
            sourceRenewalRunId,
            siteSyncRunId: syncRun?.id,
            serverExecutionJobId: syncRun?.serverExecutionJobId || undefined,
            queuedAt,
          }),
        },
        include: this.siteInclude(),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to queue TLS probe after renewal for site ${site.id}: ${this.errorMessage(error)}`,
      );

      return this.prisma.site.update({
        where: { id: site.id },
        data: {
          tls: mergeSiteTlsRenewFollowUpProbeMetadata(site.tls, {
            status: 'failed',
            sourceRenewalRunId,
            failedAt: new Date().toISOString(),
            error: this.errorMessage(error),
          }),
        },
        include: this.siteInclude(),
      });
    }
  }

  private async writeSiteSyncAudit(
    teamId: string,
    userId: string | null,
    site: SiteRecord,
    execution: {
      status: ServerExecutionResult['status'];
      mode: string;
      executorKey: string;
      adapterKey: string;
      executable: boolean;
      warnings: string[];
      error?: string;
    },
    dryRun: boolean,
    plan: SiteSyncExecutionPlan,
    syncRun: {
      id: string;
      operationApprovalId?: string | null;
      configDiff?: Prisma.JsonValue | null;
    },
    action: SiteOperationAction,
  ) {
    const label = this.siteOperationLabel(action);
    await this.auditEventService.create({
      teamId,
      actorId: userId ?? undefined,
      projectId: site.projectId,
      environmentId: site.environmentId,
      serverId: site.serverId,
      siteId: site.id,
      siteSyncRunId: syncRun.id,
      operationApprovalId: syncRun.operationApprovalId,
      category: 'site_sync',
      action,
      targetType: 'site',
      targetId: site.id,
      risk: dryRun ? 'low' : this.siteOperationRisk(action),
      status: execution.status,
      summary: `${label} ${site.name} ${execution.status}`,
      metadata: {
        dryRun,
        mode: execution.mode,
        siteName: site.name,
        primaryDomain: site.primaryDomain,
        runtimeType: site.runtimeType,
        executorKey: execution.executorKey,
        adapterKey: execution.adapterKey,
        executable: execution.executable,
        configPath: plan.target.configPath,
        siteSyncRunId: syncRun.id,
        operationApprovalId: syncRun.operationApprovalId,
        configDiff: syncRun.configDiff,
        warnings: execution.warnings,
        error: execution.error,
      },
    });
  }

  private buildApprovalBlockedExecution(
    plan: SiteSyncExecutionPlan,
    approvalId: string,
  ): ServerExecutionResult {
    const warnings = [...plan.warnings, '非 dry-run 的站点操作需要审批'];

    return {
      status: 'blocked',
      mode: 'blocked_live_execution',
      executorKey: 'server-executor',
      adapterKey: 'nginx-site-plan',
      executable: false,
      warnings,
      commandSteps: plan.commandPlan,
      commandPlan: this.toJsonValue({
        mode: 'blocked_operation_approval',
        executorKey: 'server-executor',
        adapterKey: 'nginx-site-plan',
        approvalId,
        steps: plan.commandPlan,
      }),
      logs: this.toJsonValue([
        {
          level: 'warn',
          message: '非 dry-run 的站点操作需要审批后执行',
        },
      ]),
      result: this.toJsonValue({
        mode: 'blocked_operation_approval',
        approvalId,
        executed: false,
      }),
      error: '非 dry-run 的站点操作需要审批',
    };
  }

  private buildSiteApprovalContext(
    teamId: string,
    userId: string | null,
    site: SiteRecord,
    plan: SiteSyncExecutionPlan,
    options: {
      action: SiteOperationAction;
      mode: SiteOperationMode;
      dryRun: boolean;
      queue?: boolean;
      maxAttempts?: number;
      approvalReason?: string;
      sourceRunId?: string | null;
    },
    configDiff: SiteConfigDiff,
  ) {
    const label = this.siteOperationLabel(options.action);

    return {
      teamId,
      requesterId: userId ?? undefined,
      projectId: site.projectId,
      environmentId: site.environmentId,
      serverId: site.serverId,
      siteId: site.id,
      category: 'site_sync',
      action: options.action,
      targetType: 'site',
      targetId: site.id,
      risk: this.siteOperationRisk(options.action),
      summary: `申请执行${label} ${site.name}`,
      reason: options.approvalReason || `申请执行非 dry-run ${label}`,
      metadata: {
        siteName: site.name,
        primaryDomain: site.primaryDomain,
        runtimeType: site.runtimeType,
        mode: options.mode,
        dryRun: options.dryRun,
        sourceRunId: options.sourceRunId,
        queue: options.queue === true,
        maxAttempts: options.maxAttempts,
        configPath: plan.target.configPath,
        diffSummary: configDiff.summary,
        diffAdded: configDiff.added,
        diffRemoved: configDiff.removed,
        diffSourceRunId: configDiff.sourceRunId,
      },
    };
  }

  private requiresSiteOperationApproval(action: SiteOperationAction, dryRun: boolean) {
    return !dryRun && (this.mutatesNginxConfig(this.modeForAction(action)) || action === 'site.tls_renew');
  }

  private requiresExecutionConfirmation(action: SiteOperationAction) {
    return action === 'site.sync' || action === 'site.rollback' || action === 'site.tls_renew';
  }

  private mutatesNginxConfig(mode: SiteOperationMode) {
    return mode === 'sync' || mode === 'rollback';
  }

  private mutatesSiteStatus(mode: SiteOperationMode) {
    return mode === 'sync' || mode === 'rollback';
  }

  private modeForAction(action: SiteOperationAction): SiteOperationMode {
    if (action === 'site.rollback') return 'rollback';
    if (action === 'site.diagnostics') return 'diagnostics';
    if (action === 'site.openresty_module_baseline') return 'openresty_module_baseline';
    if (action === 'site.openresty_modules') return 'openresty_modules';
    if (action === 'site.openresty_status') return 'openresty_status';
    if (action === 'site.smoke_check') return 'smoke_check';
    if (action === 'site.tls_probe') return 'tls_probe';
    if (action === 'site.tls_renew') return 'tls_renew';
    return 'sync';
  }

  private siteOperationRisk(action: SiteOperationAction) {
    if (action === 'site.rollback') return 'high';
    if (
      action === 'site.diagnostics' ||
      action === 'site.openresty_module_baseline' ||
      action === 'site.openresty_modules' ||
      action === 'site.openresty_status' ||
      action === 'site.smoke_check' ||
      action === 'site.tls_probe'
    ) {
      return 'low';
    }
    if (action === 'site.tls_renew') return 'medium';
    return 'medium';
  }

  private siteOperationLabel(action: SiteOperationAction) {
    if (action === 'site.rollback') return '站点回滚';
    if (action === 'site.diagnostics') return '站点诊断';
    if (action === 'site.openresty_module_baseline') return 'OpenResty 模块基线检查';
    if (action === 'site.openresty_modules') return 'OpenResty 模块盘点';
    if (action === 'site.openresty_status') return 'OpenResty 运行态探测';
    if (action === 'site.smoke_check') return '站点 Smoke 检查';
    if (action === 'site.tls_probe') return 'TLS 证书探测';
    if (action === 'site.tls_renew') return 'TLS 证书续期';
    return '站点同步';
  }

  private syncRunInclude(): Prisma.SiteSyncRunInclude {
    return {
      actor: { select: { id: true, name: true, email: true } },
      operationApproval: { select: { id: true, status: true, risk: true, reviewedAt: true, consumedAt: true } },
      serverExecutionJob: {
        select: {
          id: true,
          status: true,
          queueMode: true,
          attempt: true,
          maxAttempts: true,
          queuedAt: true,
          startedAt: true,
          finishedAt: true,
        },
      },
      sourceRun: {
        select: {
          id: true,
          mode: true,
          status: true,
          dryRun: true,
          startedAt: true,
          targetConfigPath: true,
        },
      },
    };
  }

  private siteInclude() {
    return {
      project: { select: { id: true, name: true } },
      environment: { select: { id: true, key: true, name: true, status: true } },
      server: { select: { id: true, name: true, host: true, status: true } },
      proxyConfig: { select: { id: true, name: true, domain: true, status: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    };
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

  private async buildConfigDiff(
    teamId: string,
    siteId: string,
    nextConfig: string,
    sourceRunId?: string | null,
  ): Promise<SiteConfigDiff> {
    const baselineRun = await this.prisma.siteSyncRun.findFirst({
      where: {
        teamId,
        siteId,
        status: 'completed',
        dryRun: false,
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true, nginxConfig: true },
    });

    const baselineConfig = baselineRun?.nginxConfig || '';
    const diff = this.diffConfigText(baselineConfig, nextConfig);
    const hasBaseline = Boolean(baselineRun);
    const hasChanges = !hasBaseline || diff.added > 0 || diff.removed > 0;

    return {
      sourceRunId: baselineRun?.id || sourceRunId || null,
      hasBaseline,
      hasChanges,
      added: diff.added,
      removed: diff.removed,
      unchanged: diff.unchanged,
      summary: hasBaseline
        ? (hasChanges
            ? `与最近成功配置相比：新增 ${diff.added} 行，删除 ${diff.removed} 行`
            : '与最近成功配置无差异')
        : `暂无成功配置快照，本次将新增 ${diff.added} 行配置`,
      unifiedDiff: diff.unifiedDiff,
    };
  }

  private buildNoConfigDiff(summary: string): SiteConfigDiff {
    return {
      sourceRunId: null,
      hasBaseline: false,
      hasChanges: false,
      added: 0,
      removed: 0,
      unchanged: 0,
      summary,
      unifiedDiff: [
        '--- last-successful-nginx.conf',
        '+++ planned-nginx.conf',
        summary,
      ].join('\n'),
    };
  }

  private diffConfigText(previousConfig: string, nextConfig: string) {
    const previousLines = previousConfig ? previousConfig.split('\n') : [];
    const nextLines = nextConfig ? nextConfig.split('\n') : [];
    const maxLength = Math.max(previousLines.length, nextLines.length);
    const lines: string[] = [];
    let added = 0;
    let removed = 0;
    let unchanged = 0;

    for (let index = 0; index < maxLength; index += 1) {
      const previousLine = previousLines[index];
      const nextLine = nextLines[index];

      if (previousLine === nextLine && nextLine !== undefined) {
        unchanged += 1;
        lines.push(` ${String(index + 1).padStart(4, ' ')} | ${nextLine}`);
        continue;
      }

      if (previousLine !== undefined) {
        removed += 1;
        lines.push(`-${String(index + 1).padStart(4, ' ')} | ${previousLine}`);
      }
      if (nextLine !== undefined) {
        added += 1;
        lines.push(`+${String(index + 1).padStart(4, ' ')} | ${nextLine}`);
      }
    }

    const maxLines = 240;
    const clipped = lines.length > maxLines;

    return {
      added,
      removed,
      unchanged,
      unifiedDiff: [
        '--- last-successful-nginx.conf',
        '+++ planned-nginx.conf',
        ...lines.slice(0, maxLines),
        ...(clipped ? [`... diff truncated, ${lines.length - maxLines} more lines`] : []),
      ].join('\n'),
    };
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
