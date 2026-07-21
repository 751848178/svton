/**
 * 数据驱动轮询列表 Hook
 *
 * 单一职责：包装 SWR，仅在列表中存在"运行中"项时保持轮询，全部终态后自动停止。
 *
 * 语义：
 * - `refreshInterval` 传函数：每次刷新后用最新数据求值，
 *   `latestData.some(isActive)` 为真时按 `interval` 继续轮询，否则返回 0 停止。
 *   首屏数据未就绪（undefined）时不轮询，拿到数据后由数据决定是否启动。
 * - `key` 为 `null` 或 `enabled === false` 时不发任何请求（SWR 条件请求）。
 * - `revalidateOnFocus: true`：窗口聚焦时重验证一次，作为轮询之外的兜底。
 * - `refreshWhenHidden / refreshWhenOffline: false`：页面隐藏或离线时不轮询。
 * - `dedupingInterval: 2000`：2 秒内重复触发（如手动 reload 与轮询撞车）合并为一次请求。
 *
 * @example
 * const runsSWR = usePollingList<BackupRun>(
 *   'GET:/backups/runs',
 *   () => apiRequest<BackupRun[]>('GET:/backups/runs'),
 *   { isActive: (run) => run.status === 'queued' || run.status === 'running', interval: 10000 },
 * );
 */

import useSWR, { type SWRResponse } from 'swr';

export interface PollingOptions<T> {
  /** 判定单项是否处于"运行中"；存在任意 active 项时保持轮询。 */
  isActive: (item: T) => boolean;
  /** 轮询间隔（毫秒），默认 5000。 */
  interval?: number;
  /** 总开关，默认 true；为 false 时等同 key = null，不发请求。 */
  enabled?: boolean;
}

export function usePollingList<T>(
  key: string | null,
  fetcher: () => Promise<T[]>,
  opts: PollingOptions<T>,
): SWRResponse<T[], Error> {
  const { isActive, interval = 5000, enabled = true } = opts;
  return useSWR<T[], Error>(enabled ? key : null, fetcher, {
    refreshInterval: (latestData) => (latestData?.some(isActive) ? interval : 0),
    revalidateOnFocus: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    dedupingInterval: 2000,
  });
}
