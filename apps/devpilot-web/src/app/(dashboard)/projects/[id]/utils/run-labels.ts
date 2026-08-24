/**
 * 部署运行状态/来源 - 标签 key 映射
 *
 * 单一职责：把运行状态、来源、环境、服务状态等原始字符串，
 * 映射为 `projects` 命名空间下的本地化 key。运行状态始终返回本地化
 * 未知兜底；来源、环境与服务值允许调用方选择各自的非原始值兜底。
 *
 * 抽取自 deployment-panel / applications-panel / environment-panel 中的重复逻辑。
 */

import { releaseRunStatusLabelKey } from './release-copy.model';

/** 部署运行状态值 → 本地化标签 key（未知值使用本地化兜底）。 */
export function getRunStatusLabelKey(status: string): string {
  return releaseRunStatusLabelKey(status);
}

/** 部署来源原始值 → 本地化标签 key（未知值返回 null）。 */
export function getRunSourceLabelKey(source: string): string | null {
  const s = source.toLowerCase();
  if (s === 'webhook') return 'runSourceWebhook';
  if (s === 'manual') return 'runSourceManual';
  if (s === 'api') return 'runSourceApi';
  if (s === 'schedule' || s === 'scheduled') return 'runSourceSchedule';
  if (s === 'release_order') return 'runSourceReleaseOrder';
  return null;
}

/** 环境状态值 → 本地化标签 key（未知值返回 null）。 */
export function getEnvStatusLabelKey(status: string): string | null {
  const s = status.toLowerCase();
  if (s === 'active') return 'envStatusActive';
  if (s === 'inactive') return 'envStatusInactive';
  return null;
}

/** 服务状态值 → 本地化标签 key（未知值返回 null）。 */
export function getServiceStatusLabelKey(status: string): string | null {
  const s = status.toLowerCase();
  if (s === 'active') return 'serviceStatusActive';
  if (s === 'inactive') return 'serviceStatusInactive';
  if (s === 'online') return 'serviceStatusOnline';
  if (s === 'offline') return 'serviceStatusOffline';
  return null;
}

/** 取 8 位短 SHA。 */
export function shortSha(sha: string | null | undefined): string | null {
  if (!sha) return null;
  return sha.length > 8 ? sha.slice(0, 8) : sha;
}

/** 终态运行状态：不会再变化的运行（blocked 可被审批后继续，不算终态）。 */
const TERMINAL_RUN_STATUSES = new Set(['succeeded', 'failed', 'cancelled', 'canceled']);

export function isTerminalRunStatus(status: string): boolean {
  return TERMINAL_RUN_STATUSES.has(status.toLowerCase());
}
