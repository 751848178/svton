/**
 * Pure site-sync approval-context, blocked-execution, and audit-input builders.
 * Extracted from `SiteService` so the execution orchestration stays focused.
 * All functions are pure value shaping (no I/O). The host injects the results
 * into the approval service / audit service / Prisma.
 */

import { Prisma } from '@prisma/client';
import { ServerExecutionResult } from '../server-executor';
import {
  siteOperationLabel,
  siteOperationRisk,
} from './site-operation-policy.utils';
import {
  type SiteConfigDiff,
  type SiteOperationAction,
  type SiteOperationMode,
  type SiteRecordLike,
  type SiteSyncExecutionPlan,
} from './site-plan.types';

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export type SiteApprovalContextOptions = {
  action: SiteOperationAction;
  mode: SiteOperationMode;
  dryRun: boolean;
  queue?: boolean;
  maxAttempts?: number;
  approvalReason?: string;
  sourceRunId?: string | null;
};

export function buildSiteApprovalContext(
  teamId: string,
  userId: string | null,
  site: SiteRecordLike,
  plan: SiteSyncExecutionPlan,
  options: SiteApprovalContextOptions,
  configDiff: SiteConfigDiff,
) {
  const label = siteOperationLabel(options.action);

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
    risk: siteOperationRisk(options.action),
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

export function buildApprovalBlockedExecution(
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
    commandPlan: toJsonValue({
      mode: 'blocked_operation_approval',
      executorKey: 'server-executor',
      adapterKey: 'nginx-site-plan',
      approvalId,
      steps: plan.commandPlan,
    }),
    logs: toJsonValue([
      { level: 'warn', message: '非 dry-run 的站点操作需要审批后执行' },
    ]),
    result: toJsonValue({
      mode: 'blocked_operation_approval',
      approvalId,
      executed: false,
    }),
    error: '非 dry-run 的站点操作需要审批',
  };
}

export type SiteSyncAuditExecution = {
  status: ServerExecutionResult['status'];
  mode: string;
  executorKey: string;
  adapterKey: string;
  executable: boolean;
  warnings: string[];
  error?: string;
};

export type SiteSyncAuditRun = {
  id: string;
  operationApprovalId?: string | null;
  configDiff?: Prisma.JsonValue | null;
};

export function buildSiteSyncAuditInput(
  teamId: string,
  userId: string | null,
  site: SiteRecordLike,
  execution: SiteSyncAuditExecution,
  dryRun: boolean,
  plan: SiteSyncExecutionPlan,
  syncRun: SiteSyncAuditRun,
  action: SiteOperationAction,
) {
  const label = siteOperationLabel(action);
  return {
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
    risk: dryRun ? 'low' : siteOperationRisk(action),
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
  };
}
