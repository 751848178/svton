/**
 * Supervisor 健康度聚合
 *
 * 单一职责：把 5 个 supervisor 状态域(workerInventory / queueCoordination /
 * remoteOrphan / agent lifecycle / agent taskPull)归并为 正常/降级/失败 计数,
 * 供首屏聚合卡与折叠组异常徽章共用同一口径。
 */

import type { ServerExecutionSupervisorSnapshot } from './supervisor';

export type SupervisorHealthLevel = 'ok' | 'degraded' | 'failed';

export interface SupervisorHealthSummary {
  ok: number;
  degraded: number;
  failed: number;
  total: number;
}

/** ready/running/idle 视为正常;degraded/disabled 视为降级;blocked 视为失败;未知状态归为正常。 */
export function classifySupervisorState(state: string): SupervisorHealthLevel {
  if (state === 'blocked') return 'failed';
  if (state === 'degraded' || state === 'disabled') return 'degraded';
  return 'ok';
}

export function summarizeSupervisorHealth(
  supervisor: ServerExecutionSupervisorSnapshot,
): SupervisorHealthSummary {
  const states = [
    supervisor.workerInventory.status.state,
    supervisor.queueCoordinationPreflight.state,
    supervisor.remoteOrphanGovernancePreflight.state,
    supervisor.agent.lifecyclePreflight.state,
    supervisor.agent.taskPullReadiness.state,
  ];
  const summary: SupervisorHealthSummary = { ok: 0, degraded: 0, failed: 0, total: states.length };
  for (const state of states) {
    summary[classifySupervisorState(state)] += 1;
  }
  return summary;
}

/** 需要人工关注的 supervisor 信号数(降级 + 失败)。 */
export function countSupervisorIssues(supervisor: ServerExecutionSupervisorSnapshot): number {
  const summary = summarizeSupervisorHealth(supervisor);
  return summary.degraded + summary.failed;
}
