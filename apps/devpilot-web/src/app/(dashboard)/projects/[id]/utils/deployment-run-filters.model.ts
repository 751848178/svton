/**
 * 部署记录筛选/排序模型（DEP-5）。
 *
 * 单一职责：URL query ↔ 筛选状态的解析，以及筛选/排序的纯计算。
 * URL 参数命名空间：runEnv / runStatus / runSource / runSort（与发布列表的
 * status 等参数互不冲突）。筛选状态进 URL，刷新/分享后可恢复。
 */

import type { DeploymentRun } from '../types/operations';

export type DeploymentRunSort = 'latest' | 'earliest';

export interface DeploymentRunFilters {
  environment: string;
  status: string;
  source: string;
  sort: DeploymentRunSort;
}

export const EMPTY_DEPLOYMENT_RUN_FILTERS: DeploymentRunFilters = {
  environment: '',
  status: '',
  source: '',
  sort: 'latest',
};

export function parseDeploymentRunFilters(
  searchParams: URLSearchParams | null,
): DeploymentRunFilters {
  if (!searchParams) return { ...EMPTY_DEPLOYMENT_RUN_FILTERS };
  const sort = searchParams.get('runSort');
  return {
    environment: searchParams.get('runEnv')?.trim() || '',
    status: searchParams.get('runStatus')?.trim() || '',
    source: searchParams.get('runSource')?.trim() || '',
    sort: sort === 'earliest' ? 'earliest' : 'latest',
  };
}

export function deploymentRunFiltersActive(filters: DeploymentRunFilters): boolean {
  return Boolean(filters.environment || filters.status || filters.source);
}

/** 应用筛选并按时间排序（默认最新优先，与列表既有顺序一致）。 */
export function applyDeploymentRunFilters(
  runs: DeploymentRun[],
  filters: DeploymentRunFilters,
): DeploymentRun[] {
  const filtered = runs.filter((run) => {
    if (filters.environment && (run.environment ?? '') !== filters.environment) return false;
    if (filters.status && run.status !== filters.status) return false;
    if (filters.source && run.source !== filters.source) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) =>
    a.startedAt === b.startedAt ? 0 : a.startedAt < b.startedAt ? -1 : 1,
  );
  return filters.sort === 'earliest' ? sorted : sorted.reverse();
}

/** 筛选选项从真实数据派生：环境取出现过的环境 key，状态/来源取出现过的原始值。 */
export function deploymentRunFilterOptions(runs: DeploymentRun[]): {
  environments: string[];
  statuses: string[];
  sources: string[];
} {
  const environments = new Set<string>();
  const statuses = new Set<string>();
  const sources = new Set<string>();
  for (const run of runs) {
    if (run.environment) environments.add(run.environment);
    statuses.add(run.status);
    sources.add(run.source);
  }
  return {
    environments: [...environments].sort(),
    statuses: [...statuses].sort(),
    sources: [...sources].sort(),
  };
}
