/**
 * Site sync execution orchestration service.
 *
 * Owns `executeSiteSyncOperation` — the core sync/diagnostics/probe/renew
 * execution loop: resolve target, compute config-diff, gate on approval,
 * submit to server-executor (direct or queued), write the sync-run + audit,
 * and delegate post-sync site/TLS updates. The 293-line method is decomposed
 * into focused sub-methods to stay under the file-size ceiling.
 * Extracted from `SiteService`. Behavior preserved verbatim.
 */

import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { OperationApprovalService } from '../operation-approval';
import { PrismaService } from '../prisma/prisma.service';
import { ServerCommandStep, ServerExecutionResult, ServerExecutorService } from '../server-executor';
import {
  isRecord,
  readString,
  type JsonRecord,
  type SiteConfigDiff,
  type SiteOperationAction,
  type SiteOperationKey,
  type SiteOperationMode,
  type SiteOperationTrigger,
  type SiteRecordLike,
  type SiteSyncExecutionPlan,
} from './site-plan.types';
import {
  mutatesNginxConfig,
  mutatesSiteStatus,
  requiresExecutionConfirmation,
  requiresSiteOperationApproval,
  siteOperationLabel,
} from './site-operation-policy.utils';
import { buildConfigDiffFromBaseline, buildNoConfigDiff } from './site-config-diff.utils';
import {
  buildApprovalBlockedExecution,
  buildSiteApprovalContext,
  buildSiteSyncAuditInput,
} from './site-sync-approval.utils';
import { SYNC_RUN_INCLUDE } from './site-includes.utils';
import { SitePostSyncUpdateService } from './site-post-sync-update.service';

type SiteRecord = SiteRecordLike & { name: string; projectId?: string | null; environmentId?: string | null };

export type SiteOperationExecutionResult = {
  mode: string; status: ServerExecutionResult['status']; executorKey: string; adapterKey: string;
  executable: boolean; warnings: string[]; commandPlan: ServerCommandStep[];
  executionPlan: Prisma.InputJsonValue; logs: Prisma.InputJsonValue; result: Prisma.InputJsonValue;
  error?: string; nginxConfig: string; configDiff: SiteConfigDiff;
  target: SiteSyncExecutionPlan['target']; syncRun: Record<string, unknown>;
  approval?: unknown; sourceRun?: unknown; site: SiteRecord;
};

export type SiteSyncOperationOptions = {
  action: SiteOperationAction; operationKey: SiteOperationKey; mode: SiteOperationMode;
  trigger: SiteOperationTrigger; dryRun: boolean; queue?: boolean; maxAttempts?: number;
  confirmationText?: string; approvalId?: string; approvalReason?: string;
  sourceRunId?: string | null; sourceRun?: unknown;
};

@Injectable()
export class SiteSyncExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serverExecutor: ServerExecutorService,
    private readonly operationApprovalService: OperationApprovalService,
    private readonly postSyncUpdateService: SitePostSyncUpdateService,
    @Optional() private readonly auditEventService?: AuditEventService,
  ) {}

  async execute(teamId: string, userId: string | null, site: SiteRecord, plan: SiteSyncExecutionPlan, options: SiteSyncOperationOptions): Promise<SiteOperationExecutionResult> {
    const target = await this.serverExecutor.resolveTarget(teamId, site.serverId);
    const configDiff = mutatesNginxConfig(options.mode)
      ? await this.buildConfigDiff(teamId, site.id, plan.nginxConfig, options.sourceRunId)
      : buildNoConfigDiff(`${siteOperationLabel(options.action)}不变更 Nginx 配置`);
    const approvalContext = buildSiteApprovalContext(teamId, userId, site, plan, options, configDiff);
    const requiresApproval = requiresSiteOperationApproval(options.action, options.dryRun);
    const approvedApproval = requiresApproval ? await this.operationApprovalService.resolveApproved({ ...approvalContext, approvalId: options.approvalId }) : null;
    const run = await this.prisma.siteSyncRun.create({
      data: {
        teamId, actorId: userId ?? undefined, siteId: site.id, projectId: site.projectId, environmentId: site.environmentId, serverId: site.serverId,
        sourceRunId: options.sourceRunId ?? undefined, operationApprovalId: approvedApproval?.id, mode: options.mode, trigger: options.trigger,
        executorKey: 'server-executor', adapterKey: 'nginx-site-plan', dryRun: options.dryRun, status: options.queue ? 'queued' : 'running',
        targetConfigPath: plan.target.configPath, nginxConfig: plan.nginxConfig, commandPlan: this.toJson(plan.commandPlan), configDiff: this.toJson(configDiff), warnings: this.toJson(plan.warnings),
      },
      include: SYNC_RUN_INCLUDE,
    });

    if (requiresApproval && !approvedApproval) return this.handleBlockedApproval(teamId, userId, site, plan, options, configDiff, approvalContext, run);
    const executionInput = this.buildExecutionInput(teamId, userId, site, plan, options, run.id, target, approvedApproval?.id);
    if (options.queue) return this.runQueued(teamId, userId, site, plan, options, configDiff, executionInput, run, approvedApproval);
    return this.runDirect(teamId, userId, site, plan, options, configDiff, executionInput, run, approvedApproval);
  }

  private buildExecutionInput(teamId: string, userId: string | null, site: SiteRecord, plan: SiteSyncExecutionPlan, options: SiteSyncOperationOptions, runId: string, target: unknown, approvalId?: string) {
    return {
      teamId, userId: userId ?? undefined, operationKey: options.operationKey, adapterKey: 'nginx-site-plan', dryRun: options.dryRun, target,
      steps: plan.commandPlan, warnings: plan.warnings,
      metadata: {
        siteId: site.id, siteSyncRunId: runId, projectId: site.projectId, environmentId: site.environmentId, siteName: site.name, primaryDomain: site.primaryDomain, runtimeType: site.runtimeType,
        configPath: plan.target.configPath, tlsProbeHost: options.mode === 'tls_probe' ? site.primaryDomain : undefined, tlsProbePort: options.mode === 'tls_probe' ? 443 : undefined,
        tlsType: options.mode === 'tls_probe' && isRecord(site.tls) ? readString((site.tls as JsonRecord).type) : undefined, mode: options.mode, trigger: options.trigger,
        sourceRunId: options.sourceRunId, operationApprovalId: approvalId, businessRunSync: options.queue ? 'site_sync' : undefined,
      },
      blockOnWarnings: !options.dryRun, requiredConfirmationText: requiresExecutionConfirmation(options.action) ? site.name : undefined, confirmationText: options.confirmationText,
    };
  }

  private async handleBlockedApproval(teamId: string, userId: string | null, site: SiteRecord, plan: SiteSyncExecutionPlan, options: SiteSyncOperationOptions, configDiff: SiteConfigDiff, approvalContext: unknown, run: Record<string, unknown>): Promise<SiteOperationExecutionResult> {
    const approval = await this.operationApprovalService.createPending({ ...(approvalContext as any), reusePending: false, metadata: { ...(approvalContext as any).metadata, siteSyncRunId: run.id, sourceRunId: options.sourceRunId, configDiff } });
    const blockedRun = await this.prisma.siteSyncRun.update({
      where: { id: run.id as string }, data: { status: 'blocked', operationApprovalId: approval.id, error: '非 dry-run 的站点操作需要审批', finishedAt: new Date(), result: this.toJson({ mode: 'blocked_operation_approval', approvalId: approval.id, approvalStatus: approval.status }) }, include: SYNC_RUN_INCLUDE,
    });
    const blocked = buildApprovalBlockedExecution(plan, approval.id);
    await this.writeAudit(teamId, userId, site, blocked, options.dryRun, plan, blockedRun, options.action);
    return { mode: blocked.mode, status: blocked.status, executorKey: blocked.executorKey, adapterKey: blocked.adapterKey, executable: blocked.executable, warnings: blocked.warnings, commandPlan: blocked.commandSteps, executionPlan: blocked.commandPlan, logs: blocked.logs, result: blocked.result, error: blocked.error, nginxConfig: plan.nginxConfig, configDiff, target: plan.target, syncRun: blockedRun, approval, sourceRun: options.sourceRun, site };
  }

  private async runQueued(teamId: string, userId: string | null, site: SiteRecord, plan: SiteSyncExecutionPlan, options: SiteSyncOperationOptions, configDiff: SiteConfigDiff, executionInput: unknown, run: Record<string, unknown>, approvedApproval: unknown): Promise<SiteOperationExecutionResult> {
    const queued = await this.serverExecutor.queueExecution(executionInput as any, { maxAttempts: options.maxAttempts });
    const queuedRun = await this.prisma.siteSyncRun.update({
      where: { id: run.id as string }, data: { status: queued.status, serverExecutionJobId: queued.serverExecutionJobId, executorKey: queued.executorKey, adapterKey: queued.adapterKey, commandPlan: this.toJson(queued.commandSteps), configDiff: this.toJson(configDiff), executionPlan: queued.commandPlan, logs: queued.logs, result: queued.result, warnings: this.toJson(queued.warnings), error: queued.error ?? null }, include: SYNC_RUN_INCLUDE,
    });
    await this.writeAudit(teamId, userId, site, queued, options.dryRun, plan, queuedRun, options.action);
    if (approvedApproval && queuedRun.status !== 'blocked') await this.operationApprovalService.consume(teamId, (approvedApproval as any).id);
    return { mode: queued.mode, status: queued.status, executorKey: queued.executorKey, adapterKey: queued.adapterKey, executable: queued.executable, warnings: queued.warnings, commandPlan: queued.commandSteps, executionPlan: queued.commandPlan, logs: queued.logs, result: queued.result, error: queued.error, nginxConfig: plan.nginxConfig, configDiff, target: plan.target, syncRun: queuedRun, sourceRun: options.sourceRun, site };
  }

  private async runDirect(teamId: string, userId: string | null, site: SiteRecord, plan: SiteSyncExecutionPlan, options: SiteSyncOperationOptions, configDiff: SiteConfigDiff, executionInput: unknown, run: Record<string, unknown>, approvedApproval: unknown): Promise<SiteOperationExecutionResult> {
    let execution: ServerExecutionResult;
    try {
      execution = await this.serverExecutor.execute(executionInput as any);
    } catch (error) {
      await this.prisma.siteSyncRun.update({ where: { id: run.id as string }, data: { status: 'failed', error: this.errorMessage(error), finishedAt: new Date() } });
      throw error;
    }
    const shouldUpdateSite = !options.dryRun && mutatesSiteStatus(options.mode);
    const syncedSite = shouldUpdateSite
      ? await this.postSyncUpdateService.updateSiteAfterSync(site.id, execution.status, execution.error)
      : await this.postSyncUpdateService.updateSiteAfterNonMutatingOperation(teamId, userId, site, execution, options.dryRun, options.mode, run.id as string);
    const syncRun = await this.prisma.siteSyncRun.update({
      where: { id: run.id as string }, data: { status: execution.status, executorKey: execution.executorKey, adapterKey: execution.adapterKey, commandPlan: this.toJson(execution.commandSteps), configDiff: this.toJson(configDiff), executionPlan: execution.commandPlan, logs: execution.logs, result: execution.result, warnings: this.toJson(execution.warnings), error: execution.error ?? null, finishedAt: new Date() }, include: SYNC_RUN_INCLUDE,
    });
    await this.writeAudit(teamId, userId, syncedSite, execution, options.dryRun, plan, syncRun, options.action);
    if (approvedApproval && syncRun.status !== 'blocked') await this.operationApprovalService.consume(teamId, (approvedApproval as any).id);
    return { mode: execution.mode, status: execution.status, executorKey: execution.executorKey, adapterKey: execution.adapterKey, executable: execution.executable, warnings: execution.warnings, commandPlan: execution.commandSteps, executionPlan: execution.commandPlan, logs: execution.logs, result: execution.result, error: execution.error, nginxConfig: plan.nginxConfig, configDiff, target: plan.target, syncRun, sourceRun: options.sourceRun, site: syncedSite };
  }

  private async buildConfigDiff(teamId: string, siteId: string, nextConfig: string, sourceRunId?: string | null): Promise<SiteConfigDiff> {
    const baselineRun = await this.prisma.siteSyncRun.findFirst({ where: { teamId, siteId, status: 'completed', dryRun: false }, orderBy: { startedAt: 'desc' }, select: { id: true, nginxConfig: true } });
    return buildConfigDiffFromBaseline(nextConfig, baselineRun, sourceRunId);
  }

  private async writeAudit(teamId: string, userId: string | null, site: SiteRecord, execution: any, dryRun: boolean, plan: SiteSyncExecutionPlan, syncRun: Record<string, unknown>, action: SiteOperationAction) {
    await this.auditEventService?.create(buildSiteSyncAuditInput(teamId, userId, site, execution, dryRun, plan, syncRun as any, action) as any);
  }

  private toJson(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
  private errorMessage(error: unknown): string { return error instanceof Error ? error.message : typeof error === 'string' ? error : '站点同步执行异常'; }
}
