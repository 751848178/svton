/**
 * Pure copy-step and resource-binding-step builders.
 *
 * Extracted verbatim from `ProjectEnvironmentService` private methods so the
 * copy and bulk-bind services stay under the 200-line ceiling. Stateless data
 * shaping. No behavior change.
 */

import { extractString, isRecord } from './project-environment-helpers.utils';

export function buildSiteCopyQueuedLiveSyncFollowUp(steps: any[]): any {
  const items: any[] = [];
  const alerts: any[] = [];
  const statusCounts: Record<string, number> = {};

  for (const step of steps) {
    const takeover = isRecord(step.metadata) && isRecord(step.metadata.openRestyTakeover)
      ? step.metadata.openRestyTakeover : null;
    const queuedLiveSync = takeover && isRecord(takeover.queuedLiveSync) ? takeover.queuedLiveSync : null;
    if (!queuedLiveSync) continue;

    const syncStatus = extractString(queuedLiveSync, 'syncStatus') || 'unknown';
    const approvalStatus = extractString(queuedLiveSync, 'approvalStatus') || null;
    const syncRunId = extractString(queuedLiveSync, 'syncRunId') || null;
    const approvalId = extractString(queuedLiveSync, 'approvalId') || null;
    const serverExecutionJobId = extractString(queuedLiveSync, 'serverExecutionJobId') || null;
    const normalizedSyncStatus = syncStatus.toLowerCase();
    const normalizedApprovalStatus = approvalStatus?.toLowerCase() || null;
    let action: string; let alertLevel: string; let alertCode: string | null = null; let alertMessage: string | null = null;

    statusCounts[syncStatus] = (statusCounts[syncStatus] || 0) + 1;

    if (normalizedApprovalStatus === 'pending' || normalizedSyncStatus === 'blocked') {
      action = 'approval_required'; alertLevel = 'warning'; alertCode = 'queued_live_sync_approval_required';
      alertMessage = 'queued live sync 等待审批通过后才会进入执行队列';
    } else if (normalizedSyncStatus === 'queued' || serverExecutionJobId) {
      action = 'monitor_queue'; alertLevel = 'info'; alertCode = 'queued_live_sync_job_queued';
      alertMessage = 'queued live sync 已进入执行队列，继续跟踪 Server executor job';
    } else if (['failed', 'error'].includes(normalizedSyncStatus)) {
      action = 'investigate_failure'; alertLevel = 'critical'; alertCode = 'queued_live_sync_failed';
      alertMessage = 'queued live sync 返回失败状态，需要人工排查';
    } else if (['completed', 'success', 'applied'].includes(normalizedSyncStatus)) {
      action = 'none'; alertLevel = 'info';
    } else {
      action = 'monitor_sync'; alertLevel = 'warning'; alertCode = 'queued_live_sync_status_unknown';
      alertMessage = 'queued live sync 未返回明确执行状态，需要检查 Site sync 结果';
    }

    const item = { sourceSiteId: step.sourceSiteId, targetSiteId: step.targetSiteId || null, syncRunId, syncStatus, approvalId, approvalStatus, serverExecutionJobId, action, alertLevel };
    items.push(item);
    if (alertCode && alertMessage) {
      alerts.push({ level: alertLevel, code: alertCode, message: alertMessage, sourceSiteId: item.sourceSiteId, targetSiteId: item.targetSiteId, syncRunId: item.syncRunId, approvalId: item.approvalId });
    }
  }

  return {
    requestedCount: items.length, statusCounts,
    metrics: {
      pendingApprovalCount: items.filter((i) => i.action === 'approval_required').length,
      queuedJobCount: items.filter((i) => i.action === 'monitor_queue').length,
      blockedCount: items.filter((i) => i.syncStatus.toLowerCase() === 'blocked').length,
      completedCount: items.filter((i) => ['completed', 'success', 'applied'].includes(i.syncStatus.toLowerCase())).length,
      failedCount: items.filter((i) => ['failed', 'error'].includes(i.syncStatus.toLowerCase())).length,
      unknownCount: items.filter((i) => i.syncStatus.toLowerCase() === 'unknown').length,
    },
    items, alerts,
  };
}

export function resourceBindingStep(
  type: string, status: string, resourceId: string, title: string,
  description: string, metadata?: Record<string, unknown>,
) {
  return { type, status, resourceId, title, description, metadata };
}
