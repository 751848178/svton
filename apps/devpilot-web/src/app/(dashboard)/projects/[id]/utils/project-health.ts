/**
 * 项目健康度 & 状态标签 - 纯函数
 *
 * 单一职责：从已有数据（最新部署运行 + 应用/服务状态）派生项目整体健康度，
 * 以及把状态/来源字符串映射为本地化 key。
 * 无副作用、无 React、无网络请求 — 单元测试友好。
 *
 * 健康度判定优先级（从高到低）：
 *   1. deploying — 最新运行处于排队/运行中/待处理等过渡态；
 *   2. degraded  — 最新运行失败/阻塞，或任一服务离线/未活跃；
 *   3. healthy   — 其余情况。
 */

import type { DeploymentRun } from '../types/operations';
import type { Project } from '../types';

export type ProjectHealth = 'healthy' | 'deploying' | 'degraded';

/** 最新一次部署运行（`deploymentRuns` 按最新在前返回）。 */
export function getLatestDeploymentRun(runs?: DeploymentRun[]): DeploymentRun | null {
  if (!runs || runs.length === 0) return null;
  return runs[0];
}

/** 判断最新运行是否处于过渡态（部署中）。 */
function isRunInProgress(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'queued' || s === 'running' || s === 'pending' || s === 'provisioning';
}

/** 判断最新运行是否为失败/阻塞（降级）。 */
function isRunDegraded(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'failed' || s === 'blocked' || s === 'error';
}

/** 检查是否存在离线/未活跃的服务。 */
function hasOfflineService(project?: Project | null): boolean {
  if (!project?.applications) return false;
  return project.applications.some((app) =>
    (app.services ?? []).some((svc) => {
      const s = svc.status.toLowerCase();
      return s === 'offline' || s === 'inactive' || s === 'stopped';
    }),
  );
}

/**
 * 派生项目整体健康度。仅读取已有数据，不发起任何请求。
 *
 * 输入顺序为优先级：先看最新部署运行，再看服务状态。
 */
export function getProjectHealth(args: {
  runs?: DeploymentRun[];
  project?: Project | null;
}): ProjectHealth {
  const latest = getLatestDeploymentRun(args.runs);
  if (latest && isRunInProgress(latest.status)) return 'deploying';
  if ((latest && isRunDegraded(latest.status)) || hasOfflineService(args.project)) {
    return 'degraded';
  }
  return 'healthy';
}

/** 健康度值 → 本地化标签 key（在 `projects` 命名空间下）。 */
export function getHealthLabelKey(health: ProjectHealth): string {
  if (health === 'deploying') return 'healthDeploying';
  if (health === 'degraded') return 'healthDegraded';
  return 'healthHealthy';
}

/**
 * 健康度 → 传递给 StatusTag 的 status 值。
 * StatusTag 通过 status-map 归一化为语义色调：
 *   healthy → success（绿）、deploying → progress（呼吸点）、degraded → danger（红）。
 */
export function getHealthStatusValue(health: ProjectHealth): string {
  if (health === 'deploying') return 'deploying';
  if (health === 'degraded') return 'failed';
  return 'healthy';
}
