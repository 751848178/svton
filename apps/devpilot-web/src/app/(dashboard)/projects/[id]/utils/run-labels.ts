/**
 * 部署运行状态/来源 - 标签 key 映射
 *
 * 单一职责：把运行状态、来源、环境、服务状态等原始字符串，
 * 映射为 `projects` 命名空间下的本地化 key。返回 null 表示无匹配，
 * 由调用方回退展示原始值。
 *
 * 抽取自 deployment-panel / applications-panel / environment-panel 中的重复逻辑。
 */

/** 部署运行状态值 → 本地化标签 key（未知值返回 null）。 */
export function getRunStatusLabelKey(status: string): string | null {
  const s = status.toLowerCase();
  if (s === 'queued') return 'runStatusQueued';
  if (s === 'running') return 'runStatusRunning';
  if (s === 'completed') return 'runStatusCompleted';
  if (s === 'failed') return 'runStatusFailed';
  if (s === 'blocked') return 'runStatusBlocked';
  if (s === 'succeeded' || s === 'success') return 'runStatusSucceeded';
  if (s === 'pending') return 'runStatusPending';
  if (s === 'cancelled' || s === 'canceled') return 'runStatusCancelled';
  return null;
}

/** 部署来源原始值 → 本地化标签 key（未知值返回 null）。 */
export function getRunSourceLabelKey(source: string): string | null {
  const s = source.toLowerCase();
  if (s === 'webhook') return 'runSourceWebhook';
  if (s === 'manual') return 'runSourceManual';
  if (s === 'api') return 'runSourceApi';
  if (s === 'schedule' || s === 'scheduled') return 'runSourceSchedule';
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
