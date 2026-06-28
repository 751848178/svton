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

type JsonRecord = Record<string, unknown>;
type SiteRecord = Awaited<ReturnType<SiteService['getSite']>>;
type SiteSyncExecutionPlan = {
  target: {
    serverId?: string | null;
    serverName?: string;
    serverHost?: string;
    configPath: string;
    runtimeType: string;
  };
  warnings: string[];
  commandPlan: ServerCommandStep[];
  nginxConfig: string;
};
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

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

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

    if (!this.isPreviewSitePlaceholder(runtimeConfig)) {
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
    if (!this.isSafeUpstream(upstreamUrl)) {
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
    const plan = this.buildSyncPlan(site);
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
    const plan = this.buildDiagnosticsPlan(site, dto.tailLines);
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
    const plan = this.buildOpenRestyStatusPlan(site);
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
    const plan = this.buildOpenRestyModulesPlan(site);
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
    const plan = this.buildOpenRestyModuleBaselinePlan(site);
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
    const plan = this.buildSmokeCheckPlan(site);
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
    const plan = this.buildTlsProbePlan(site);
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
    const plan = this.buildTlsRenewPlan(site, dryRun);

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
    const plan = this.buildRollbackPlan(site, sourceRun.nginxConfig, sourceRun.targetConfigPath);

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

  private buildSyncPlan(site: Awaited<ReturnType<SiteService['getSite']>>) {
    const runtimeConfig = isRecord(site.runtimeConfig) ? site.runtimeConfig : {};
    const tls = isRecord(site.tls) ? site.tls : {};
    const accessPolicy = isRecord(site.accessPolicy) ? site.accessPolicy : {};
    const aliases = readStringArray(site.aliases);
    const serverNames = [site.primaryDomain, ...aliases].filter(Boolean);
    const nginxConfig = this.generateNginxConfig(
      site.runtimeType as SiteRuntimeType,
      site.primaryDomain,
      serverNames,
      runtimeConfig,
      tls,
      accessPolicy,
    );
    const configPath = `/etc/nginx/conf.d/${this.filenameForDomain(site.primaryDomain)}.conf`;
    const warnings = this.collectWarnings(site, runtimeConfig, tls);
    const commandPlan: ServerCommandStep[] = [
      {
        key: 'write_nginx_config',
        label: '写入 Nginx 站点配置',
        command: `cat > ${configPath} <<'EOF'\n${nginxConfig}\nEOF`,
        preview: configPath,
        required: true,
        risk: 'medium',
        timeoutSeconds: 30,
      },
      {
        key: 'issue_certificate',
        label: '签发或续期证书',
        command: this.buildCertificateCommand(serverNames, tls),
        required: readBoolean(tls.enabled) === true && readString(tls.type) === 'letsencrypt',
        risk: 'medium',
        timeoutSeconds: 180,
      },
      {
        key: 'validate_nginx',
        label: '校验 Nginx 配置',
        command: 'nginx -t',
        required: true,
        risk: 'low',
        timeoutSeconds: 30,
      },
      {
        key: 'reload_nginx',
        label: '重载 Nginx',
        command: 'systemctl reload nginx || nginx -s reload',
        required: true,
        risk: 'medium',
        timeoutSeconds: 30,
      },
    ];

    return {
      target: {
        serverId: site.serverId,
        serverName: site.server?.name,
        serverHost: site.server?.host,
        configPath,
        runtimeType: site.runtimeType,
      },
      warnings,
      commandPlan,
      nginxConfig,
    };
  }

  private buildRollbackPlan(
    site: SiteRecord,
    nginxConfig: string,
    targetConfigPath?: string | null,
  ): SiteSyncExecutionPlan {
    const fallbackConfigPath = `/etc/nginx/conf.d/${this.filenameForDomain(site.primaryDomain)}.conf`;
    const configPath = targetConfigPath && this.isSafeNginxSiteConfigPath(targetConfigPath)
      ? targetConfigPath
      : fallbackConfigPath;
    const warnings: string[] = [];

    if (!site.serverId) {
      warnings.push('未关联目标服务器，无法生成可执行的 server-executor 回滚计划');
    }
    if (targetConfigPath && targetConfigPath !== configPath) {
      warnings.push('历史同步记录中的配置路径不安全，已回退到当前站点默认 Nginx 配置路径');
    }

    const commandPlan: ServerCommandStep[] = [
      {
        key: 'write_nginx_config',
        label: '写回历史 Nginx 站点配置',
        command: `cat > ${configPath} <<'EOF'\n${nginxConfig}\nEOF`,
        preview: configPath,
        required: true,
        risk: 'medium',
        timeoutSeconds: 30,
      },
      {
        key: 'validate_nginx',
        label: '校验 Nginx 配置',
        command: 'nginx -t',
        required: true,
        risk: 'low',
        timeoutSeconds: 30,
      },
      {
        key: 'reload_nginx',
        label: '重载 Nginx',
        command: 'systemctl reload nginx || nginx -s reload',
        required: true,
        risk: 'medium',
        timeoutSeconds: 30,
      },
    ];

    return {
      target: {
        serverId: site.serverId,
        serverName: site.server?.name,
        serverHost: site.server?.host,
        configPath,
        runtimeType: site.runtimeType,
      },
      warnings,
      commandPlan,
      nginxConfig,
    };
  }

  private buildDiagnosticsPlan(site: SiteRecord, tailLines?: number): SiteSyncExecutionPlan {
    const basePlan = this.buildSyncPlan(site);
    const lines = this.normalizeTailLines(tailLines);
    const commandPlan: ServerCommandStep[] = [
      {
        key: 'validate_nginx',
        label: '校验 Nginx/OpenResty 配置',
        command: 'nginx -t',
        required: true,
        risk: 'low',
        timeoutSeconds: 30,
      },
      {
        key: 'tail_nginx_access_log',
        label: `读取 access.log 最近 ${lines} 行`,
        command: `tail -n ${lines} /var/log/nginx/access.log || true`,
        preview: '/var/log/nginx/access.log',
        required: false,
        risk: 'low',
        timeoutSeconds: 20,
      },
      {
        key: 'tail_nginx_error_log',
        label: `读取 error.log 最近 ${lines} 行`,
        command: `tail -n ${lines} /var/log/nginx/error.log || true`,
        preview: '/var/log/nginx/error.log',
        required: false,
        risk: 'low',
        timeoutSeconds: 20,
      },
    ];

    return {
      ...basePlan,
      commandPlan,
      warnings: basePlan.warnings,
    };
  }

  private buildOpenRestyStatusPlan(site: SiteRecord): SiteSyncExecutionPlan {
    const warnings = this.collectOpenRestyStatusWarnings(site);
    const commandPlan: ServerCommandStep[] = [
      {
        key: 'nginx_config_test_status',
        label: '读取 Nginx/OpenResty 配置测试结果',
        command: 'nginx -t 2>&1 || true',
        required: false,
        risk: 'low',
        timeoutSeconds: 30,
      },
      {
        key: 'nginx_build_info',
        label: '读取 Nginx 构建信息',
        command: 'nginx -V 2>&1 || true',
        required: false,
        risk: 'low',
        timeoutSeconds: 10,
      },
      {
        key: 'openresty_build_info',
        label: '读取 OpenResty 构建信息',
        command: 'openresty -V 2>&1 || true',
        required: false,
        risk: 'low',
        timeoutSeconds: 10,
      },
      {
        key: 'nginx_service_status',
        label: '读取 Nginx systemd 活跃状态',
        command: 'systemctl is-active nginx || true',
        required: false,
        risk: 'low',
        timeoutSeconds: 10,
      },
      {
        key: 'openresty_service_status',
        label: '读取 OpenResty systemd 活跃状态',
        command: 'systemctl is-active openresty || true',
        required: false,
        risk: 'low',
        timeoutSeconds: 10,
      },
      {
        key: 'nginx_openresty_process_status',
        label: '读取 Nginx/OpenResty 进程摘要',
        command: "ps -eo pid,comm,args | grep -E 'nginx|openresty' | grep -v grep | head -20 || true",
        required: false,
        risk: 'low',
        timeoutSeconds: 10,
      },
    ];

    return {
      target: {
        serverId: site.serverId,
        serverName: site.server?.name,
        serverHost: site.server?.host,
        configPath: `openresty-status://${site.primaryDomain || site.id}`,
        runtimeType: site.runtimeType,
      },
      commandPlan,
      warnings,
      nginxConfig: '',
    };
  }

  private buildOpenRestyModulesPlan(site: SiteRecord): SiteSyncExecutionPlan {
    const warnings = this.collectOpenRestyModulesWarnings(site);
    const commandPlan: ServerCommandStep[] = [
      {
        key: 'nginx_module_config_args',
        label: '读取 Nginx 编译模块参数',
        command: 'nginx -V 2>&1 || true',
        required: false,
        risk: 'low',
        timeoutSeconds: 10,
      },
      {
        key: 'openresty_module_config_args',
        label: '读取 OpenResty 编译模块参数',
        command: 'openresty -V 2>&1 || true',
        required: false,
        risk: 'low',
        timeoutSeconds: 10,
      },
      {
        key: 'nginx_dynamic_module_files',
        label: '读取 Nginx/OpenResty 动态模块文件',
        command: "find /etc/nginx/modules-enabled /usr/lib/nginx/modules /usr/local/openresty/nginx/modules -maxdepth 1 -type f -name '*.so' -print 2>/dev/null | sort || true",
        required: false,
        risk: 'low',
        timeoutSeconds: 10,
      },
    ];

    return {
      target: {
        serverId: site.serverId,
        serverName: site.server?.name,
        serverHost: site.server?.host,
        configPath: `openresty-modules://${site.primaryDomain || site.id}`,
        runtimeType: site.runtimeType,
      },
      commandPlan,
      warnings,
      nginxConfig: '',
    };
  }

  private buildOpenRestyModuleBaselinePlan(site: SiteRecord): SiteSyncExecutionPlan {
    const warnings = this.collectOpenRestyModuleBaselineWarnings(site);
    const commandPlan: ServerCommandStep[] = [
      {
        key: 'baseline_tls_module',
        label: '检查 TLS/SSL 模块能力',
        command: "(nginx -V 2>&1 || true; openresty -V 2>&1 || true) | grep -Eq -- '--with-http_ssl_module|--with-openssl' && echo 'present: tls' || echo 'missing: tls'",
        required: false,
        risk: 'low',
        timeoutSeconds: 10,
      },
      {
        key: 'baseline_http2_module',
        label: '检查 HTTP/2 或 HTTP/3 模块能力',
        command: "(nginx -V 2>&1 || true; openresty -V 2>&1 || true) | grep -Eq -- '--with-http_v2_module|--with-http_v3_module' && echo 'present: http2_or_http3' || echo 'missing: http2_or_http3'",
        required: false,
        risk: 'low',
        timeoutSeconds: 10,
      },
      {
        key: 'baseline_realip_module',
        label: '检查真实客户端 IP 模块能力',
        command: "(nginx -V 2>&1 || true; openresty -V 2>&1 || true) | grep -Eq -- '--with-http_realip_module' && echo 'present: realip' || echo 'missing: realip'",
        required: false,
        risk: 'low',
        timeoutSeconds: 10,
      },
      {
        key: 'baseline_stub_status_module',
        label: '检查 stub_status 状态模块能力',
        command: "(nginx -V 2>&1 || true; openresty -V 2>&1 || true) | grep -Eq -- '--with-http_stub_status_module' && echo 'present: stub_status' || echo 'missing: stub_status'",
        required: false,
        risk: 'low',
        timeoutSeconds: 10,
      },
      {
        key: 'baseline_stream_module',
        label: '检查 stream 转发模块能力',
        command: "(nginx -V 2>&1 || true; openresty -V 2>&1 || true) | grep -Eq -- '--with-stream' && echo 'present: stream' || echo 'missing: stream'",
        required: false,
        risk: 'low',
        timeoutSeconds: 10,
      },
      {
        key: 'baseline_lua_module',
        label: '检查 Lua/OpenResty 模块能力',
        command: "(nginx -V 2>&1 || true; openresty -V 2>&1 || true; find /etc/nginx/modules-enabled /usr/lib/nginx/modules /usr/local/openresty/nginx/modules -maxdepth 1 -type f -name '*.so' -print 2>/dev/null || true) | grep -Eiq 'http_lua|lua-nginx|ngx_http_lua|lua.*\\.so' && echo 'present: lua' || echo 'missing: lua'",
        required: false,
        risk: 'low',
        timeoutSeconds: 10,
      },
    ];

    return {
      target: {
        serverId: site.serverId,
        serverName: site.server?.name,
        serverHost: site.server?.host,
        configPath: `openresty-module-baseline://${site.primaryDomain || site.id}`,
        runtimeType: site.runtimeType,
      },
      commandPlan,
      warnings,
      nginxConfig: '',
    };
  }

  private buildSmokeCheckPlan(site: SiteRecord): SiteSyncExecutionPlan {
    const warnings = this.collectSmokeCheckWarnings(site);
    const runtimeConfig = isRecord(site.runtimeConfig) ? site.runtimeConfig : {};
    const tls = isRecord(site.tls) ? site.tls : {};
    const scheme = readBoolean(tls.enabled) === true ? 'https' : 'http';
    const domainUrl = `${scheme}://${site.primaryDomain}`;
    const localUrl = 'http://127.0.0.1/';
    const upstream = this.resolveUpstream(site.runtimeType as SiteRuntimeType, runtimeConfig);
    const commandPlan: ServerCommandStep[] = [
      {
        key: 'public_domain_smoke',
        label: '访问公开域名',
        command: this.isSafeProbeHostname(site.primaryDomain) ? `curl -fsS ${domainUrl}` : '',
        preview: domainUrl,
        required: true,
        risk: 'low',
        timeoutSeconds: 20,
      },
      {
        key: 'nginx_local_host_smoke',
        label: '本机 Nginx Host 路由检查',
        command: this.isSafeProbeHostname(site.primaryDomain)
          ? `curl -fsS -H 'Host: ${site.primaryDomain}' ${localUrl}`
          : '',
        preview: `${localUrl} Host: ${site.primaryDomain}`,
        required: false,
        risk: 'low',
        timeoutSeconds: 20,
      },
      {
        key: 'upstream_smoke',
        label: '上游服务检查',
        command: upstream && this.isSafeUpstream(upstream) ? `curl -fsS ${upstream}` : '',
        preview: upstream || '未配置上游',
        required: false,
        risk: 'low',
        timeoutSeconds: 20,
      },
    ];

    return {
      target: {
        serverId: site.serverId,
        serverName: site.server?.name,
        serverHost: site.server?.host,
        configPath: `smoke://${site.primaryDomain}`,
        runtimeType: site.runtimeType,
      },
      commandPlan,
      warnings,
      nginxConfig: '',
    };
  }

  private buildTlsProbePlan(site: SiteRecord): SiteSyncExecutionPlan {
    const warnings = this.collectTlsProbeWarnings(site);
    const host = site.primaryDomain;
    const commandPlan: ServerCommandStep[] = [
      {
        key: 'probe_tls_certificate',
        label: '探测站点 TLS 证书',
        command: this.isSafeProbeHostname(host) ? buildSiteTlsProbeCommand(host, 443) : '',
        preview: `${host}:443`,
        required: true,
        risk: 'low',
        timeoutSeconds: 20,
      },
    ];

    return {
      target: {
        serverId: site.serverId,
        serverName: site.server?.name,
        serverHost: site.server?.host,
        configPath: `tls://${host}:443`,
        runtimeType: site.runtimeType,
      },
      commandPlan,
      warnings,
      nginxConfig: '',
    };
  }

  private buildTlsRenewPlan(site: SiteRecord, dryRun: boolean): SiteSyncExecutionPlan {
    const tls = isRecord(site.tls) ? site.tls : {};
    const certName = this.resolveCertificateName(site, tls);
    const warnings = this.collectTlsRenewWarnings(site, tls, certName);
    const commandPlan: ServerCommandStep[] = [
      {
        key: 'renew_tls_certificate',
        label: dryRun ? '演练续期 TLS 证书' : '续期 TLS 证书',
        command: this.isSafeProbeHostname(certName)
          ? this.buildCertificateRenewCommand(certName, dryRun)
          : '',
        preview: certName,
        required: true,
        risk: dryRun ? 'low' : 'medium',
        timeoutSeconds: dryRun ? 240 : 300,
      },
      {
        key: 'validate_nginx',
        label: '校验 Nginx/OpenResty 配置',
        command: 'nginx -t',
        required: !dryRun,
        risk: 'low',
        timeoutSeconds: 30,
      },
      {
        key: 'reload_nginx',
        label: '重载 Nginx/OpenResty',
        command: 'systemctl reload nginx || nginx -s reload',
        required: !dryRun,
        risk: 'medium',
        timeoutSeconds: 30,
      },
    ];

    return {
      target: {
        serverId: site.serverId,
        serverName: site.server?.name,
        serverHost: site.server?.host,
        configPath: `tls-renew://${certName}`,
        runtimeType: site.runtimeType,
      },
      commandPlan,
      warnings,
      nginxConfig: '',
    };
  }

  private collectTlsProbeWarnings(site: SiteRecord) {
    const warnings: string[] = [];

    if (!site.serverId) {
      warnings.push('未关联目标服务器，无法通过 Server executor 探测 TLS 证书');
    }
    if (!site.primaryDomain) {
      warnings.push('未配置主域名');
    } else if (!this.isSafeProbeHostname(site.primaryDomain)) {
      warnings.push('主域名不是可探测的安全域名，TLS 证书探测只支持普通域名，不支持通配符或特殊字符');
    }

    return warnings;
  }

  private collectSmokeCheckWarnings(site: SiteRecord) {
    const warnings: string[] = [];
    const runtimeConfig = isRecord(site.runtimeConfig) ? site.runtimeConfig : {};
    const upstream = this.resolveUpstream(site.runtimeType as SiteRuntimeType, runtimeConfig);

    if (!site.serverId) {
      warnings.push('未关联目标服务器，无法通过 Server executor 执行站点 Smoke 检查');
    }
    if (!site.primaryDomain) {
      warnings.push('未配置主域名');
    } else if (!this.isSafeProbeHostname(site.primaryDomain)) {
      warnings.push('主域名不是可探测的安全域名，Smoke 检查只支持普通域名，不支持通配符或特殊字符');
    }
    if (upstream && !this.isSafeUpstream(upstream)) {
      warnings.push('上游地址包含不安全字符，Smoke 检查不会生成上游访问命令');
    }

    return warnings;
  }

  private collectOpenRestyStatusWarnings(site: SiteRecord) {
    const warnings: string[] = [];

    if (!site.serverId) {
      warnings.push('未关联目标服务器，无法通过 Server executor 探测 OpenResty/Nginx 运行态');
    }

    return warnings;
  }

  private collectOpenRestyModulesWarnings(site: SiteRecord) {
    const warnings: string[] = [];

    if (!site.serverId) {
      warnings.push('未关联目标服务器，无法通过 Server executor 盘点 OpenResty/Nginx 模块');
    }

    return warnings;
  }

  private collectOpenRestyModuleBaselineWarnings(site: SiteRecord) {
    const warnings: string[] = [];

    if (!site.serverId) {
      warnings.push('未关联目标服务器，无法通过 Server executor 检查 OpenResty/Nginx 模块基线');
    }

    return warnings;
  }

  private collectTlsRenewWarnings(site: SiteRecord, tls: JsonRecord, certName: string) {
    const warnings: string[] = [];

    if (!site.serverId) {
      warnings.push('未关联目标服务器，无法通过 Server executor 续期 TLS 证书');
    }
    if (!site.primaryDomain) {
      warnings.push('未配置主域名');
    } else if (!this.isSafeProbeHostname(site.primaryDomain)) {
      warnings.push('主域名不是可续期的安全域名，证书续期只支持普通域名，不支持通配符或特殊字符');
    }
    if (readBoolean(tls.enabled) !== true || readString(tls.type) !== 'letsencrypt') {
      warnings.push('当前站点未启用 Let’s Encrypt TLS，无法生成 certbot 续期计划');
    }
    if (!this.isSafeProbeHostname(certName)) {
      warnings.push('证书名称不是安全域名格式，无法生成 certbot 续期命令');
    }

    return warnings;
  }

  private normalizeTailLines(value?: number) {
    if (!Number.isFinite(value)) {
      return 200;
    }
    return Math.max(10, Math.min(Math.floor(value || 200), 1000));
  }

  private collectWarnings(
    site: Awaited<ReturnType<SiteService['getSite']>>,
    runtimeConfig: JsonRecord,
    tls: JsonRecord,
  ) {
    const warnings: string[] = [];

    if (readBoolean(runtimeConfig.syncBlocked) === true) {
      warnings.push(
        readString(runtimeConfig.syncBlockedReason) ||
        '当前站点被标记为占位配置，需要补齐真实运行时和域名策略后才能同步',
      );
    }

    if (!site.serverId) {
      warnings.push('未关联目标服务器，无法生成可执行的 server-executor 计划');
    }
    if (!site.primaryDomain) {
      warnings.push('未配置主域名');
    } else if (!this.isSafeDomain(site.primaryDomain)) {
      warnings.push('主域名包含不安全字符，无法写入 Nginx 配置');
    }

    for (const alias of readStringArray(site.aliases)) {
      if (!this.isSafeDomain(alias)) {
        warnings.push(`域名别名 ${alias} 包含不安全字符，无法写入 Nginx 配置`);
      }
    }

    if (site.runtimeType === 'static') {
      const rootPath = readString(runtimeConfig.rootPath);
      if (!rootPath) {
        warnings.push('静态站点未配置 rootPath');
      } else if (!this.isSafeNginxPath(rootPath)) {
        warnings.push('静态站点 rootPath 必须是安全的绝对路径');
      }
    } else {
      const upstream = this.resolveUpstream(site.runtimeType as SiteRuntimeType, runtimeConfig);
      if (!upstream) {
        warnings.push('反向代理/运行时站点未配置 upstreamUrl 或 host/port');
      } else if (!this.isSafeUpstream(upstream)) {
        warnings.push('上游地址必须是安全的 http/https upstream，且不能包含空白或 shell/nginx 注入字符');
      }
    }

    if (readBoolean(tls.enabled) === true && readString(tls.type) === 'letsencrypt' && !readString(tls.email)) {
      warnings.push('Let’s Encrypt 未配置 email，证书签发命令需要补齐联系人邮箱');
    }

    return warnings;
  }

  private isSafeDomain(domain: string) {
    return /^(?:\*\.)?(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(domain);
  }

  private isSafeProbeHostname(domain: string) {
    return /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(domain);
  }

  private isSafeNginxPath(path: string) {
    return /^\/(?!.*\.\.)(?:[a-zA-Z0-9._@-]+\/?)+$/.test(path);
  }

  private isSafeNginxSiteConfigPath(path: string) {
    return /^\/etc\/nginx\/conf\.d\/[a-z0-9.-]+\.conf$/.test(path);
  }

  private isSafeUpstream(upstream: string) {
    return /^https?:\/\/[a-zA-Z0-9._:-]+(?:\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?$/.test(upstream)
      && !/[\s{};`$\\]/.test(upstream);
  }

  private generateNginxConfig(
    runtimeType: SiteRuntimeType,
    primaryDomain: string,
    serverNames: string[],
    runtimeConfig: JsonRecord,
    tls: JsonRecord,
    accessPolicy: JsonRecord,
  ) {
    const tlsEnabled = readBoolean(tls.enabled) === true;
    const serverNameLine = serverNames.length > 0 ? serverNames.join(' ') : primaryDomain;
    const lines: string[] = [
      'server {',
      tlsEnabled ? '    listen 443 ssl http2;' : '    listen 80;',
      tlsEnabled ? '    listen [::]:443 ssl http2;' : '    listen [::]:80;',
      `    server_name ${serverNameLine};`,
      '',
    ];

    if (tlsEnabled) {
      lines.push(
        `    ssl_certificate /etc/letsencrypt/live/${primaryDomain}/fullchain.pem;`,
        `    ssl_certificate_key /etc/letsencrypt/live/${primaryDomain}/privkey.pem;`,
        '    ssl_protocols TLSv1.2 TLSv1.3;',
        '',
      );
    }

    lines.push(...this.generateAccessPolicy(accessPolicy));

    if (runtimeType === 'static') {
      const rootPath = readString(runtimeConfig.rootPath) || `/var/www/${primaryDomain}`;
      lines.push(
        '    location / {',
        `        root ${rootPath};`,
        '        try_files $uri $uri/ /index.html;',
        '    }',
      );
    } else {
      const upstream = this.resolveUpstream(runtimeType, runtimeConfig) || 'http://127.0.0.1:3000';
      lines.push(
        '    location / {',
        `        proxy_pass ${upstream};`,
        '        proxy_http_version 1.1;',
        '        proxy_set_header Host $host;',
        '        proxy_set_header X-Real-IP $remote_addr;',
        '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
        '        proxy_set_header X-Forwarded-Proto $scheme;',
      );

      if (readBoolean(runtimeConfig.websocket) === true) {
        lines.push(
          '        proxy_set_header Upgrade $http_upgrade;',
          '        proxy_set_header Connection "upgrade";',
        );
      }

      lines.push('    }');
    }

    lines.push('}');

    if (tlsEnabled) {
      lines.push(
        '',
        'server {',
        '    listen 80;',
        '    listen [::]:80;',
        `    server_name ${serverNameLine};`,
        '    return 301 https://$server_name$request_uri;',
        '}',
      );
    }

    return lines.join('\n');
  }

  private generateAccessPolicy(accessPolicy: JsonRecord) {
    const lines: string[] = [];
    const allowedCidrs = readStringArray(accessPolicy.allowedCidrs);

    if (allowedCidrs.length > 0) {
      for (const cidr of allowedCidrs) {
        lines.push(`    allow ${cidr};`);
      }
      lines.push('    deny all;', '');
    }

    if (readBoolean(accessPolicy.basicAuth) === true) {
      lines.push(
        '    auth_basic "Devpilot managed site";',
        '    auth_basic_user_file /etc/nginx/.htpasswd;',
        '',
      );
    }

    return lines;
  }

  private resolveUpstream(runtimeType: SiteRuntimeType, runtimeConfig: JsonRecord) {
    const upstreamUrl = readString(runtimeConfig.upstreamUrl);
    if (upstreamUrl) return upstreamUrl;

    const host = readString(runtimeConfig.host);
    const port = readString(runtimeConfig.port) || String(runtimeConfig.port || '');
    if (host && port) {
      return `http://${host}:${port}`;
    }

    if (runtimeType === 'docker') {
      const containerName = readString(runtimeConfig.containerName);
      const containerPort = readString(runtimeConfig.containerPort) || String(runtimeConfig.containerPort || '');
      if (containerName && containerPort) {
        return `http://${containerName}:${containerPort}`;
      }
    }

    return undefined;
  }

  private buildCertificateCommand(serverNames: string[], tls: JsonRecord) {
    if (readBoolean(tls.enabled) !== true || readString(tls.type) !== 'letsencrypt') {
      return '';
    }

    const email = readString(tls.email);
    if (!email) {
      return '';
    }

    const domains = serverNames.map((domain) => `-d ${domain}`).join(' ');
    return `certbot --nginx ${domains} --email ${email} --agree-tos --non-interactive`;
  }

  private buildCertificateRenewCommand(certName: string, dryRun: boolean) {
    const dryRunFlag = dryRun ? ' --dry-run' : '';
    return `certbot renew --cert-name ${certName}${dryRunFlag} --non-interactive`;
  }

  private resolveCertificateName(site: SiteRecord, tls: JsonRecord) {
    return readString(tls.certName) || site.primaryDomain;
  }

  private isPreviewSitePlaceholder(runtimeConfig: JsonRecord) {
    const preview = isRecord(runtimeConfig.preview) ? runtimeConfig.preview : {};

    return readString(preview.kind) === 'draft_site_placeholder';
  }

  private cleanAliases(aliases: string[]) {
    return aliases.map((alias) => alias.trim()).filter(Boolean);
  }

  private filenameForDomain(domain: string) {
    return domain.toLowerCase().replace(/[^a-z0-9.-]/g, '-');
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    return typeof error === 'string' ? error : '站点同步执行异常';
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
