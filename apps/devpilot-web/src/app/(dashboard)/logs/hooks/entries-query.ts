/**
 * 日志条目/统计查询参数构造与请求。
 *
 * 单一职责：把 explorer 过滤器（stream/level/query/timeRange）映射为后端
 * GET /logs/entries 与 GET /logs/stats 支持的 query 参数。
 * 后端 DTO（ListLogEntriesQueryDto / ListLogStatsQueryDto）字段：
 *   streamId / level / source / q / projectId / serverId / siteId /
 *   managedResourceId / applicationServiceId / environmentId；
 *   stats 另支持 windowMinutes / sourceType / status。
 */

import { apiRequest } from '@/lib/api-client';
import type { LogsState } from './use-logs-state';
import type { LogEntry } from '../types-stream';
import type { LogStats } from '../types';

export interface EntriesQuery {
  streamId?: string;
  q?: string;
  level?: string;
  source?: string;
  windowMinutes?: number;
}

/** 仅保留有意义的非空字段，避免发出空字符串参数。 */
export function buildEntriesParams(s: LogsState): EntriesQuery {
  const params: EntriesQuery = {};
  if (s.selectedStreamId) params.streamId = s.selectedStreamId;
  const q = s.activeQuery.trim();
  if (q) params.q = q;
  if (s.activeLevel !== 'all') params.level = s.activeLevel;
  if (s.timeRangeMinutes > 0) params.windowMinutes = s.timeRangeMinutes;
  return params;
}

/** 统计参数：与条目共享过滤范围，并补齐 windowMinutes（stats DTO 原生支持）。 */
export function buildStatsParams(s: LogsState): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  const stream = s.streams.find((st) => st.id === s.selectedStreamId);
  if (s.selectedStreamId) params.streamId = s.selectedStreamId;
  if (stream?.sourceType) params.sourceType = stream.sourceType;
  if (s.activeLevel !== 'all') params.level = s.activeLevel;
  if (s.timeRangeMinutes > 0) params.windowMinutes = s.timeRangeMinutes;
  return params;
}

/** 按 explorer 过滤器拉取历史条目（windowMinutes 仅 stats 原生支持，entries 预留）。 */
export async function fetchEntries(s: LogsState): Promise<LogEntry[]> {
  return apiRequest<LogEntry[]>('GET:/logs/entries', buildEntriesParams(s));
}

/** 按 explorer 过滤器拉取统计（windowMinutes 原生生效）。 */
export async function fetchStats(s: LogsState): Promise<LogStats | null> {
  return apiRequest<LogStats>('GET:/logs/stats', buildStatsParams(s));
}
