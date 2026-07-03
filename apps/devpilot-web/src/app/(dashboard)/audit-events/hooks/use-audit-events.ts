/**
 * 审计事件数据 Hook
 *
 * 单一职责：拉取审计事件全量列表（SWR，首屏 server 数据透传 fallback），
 * 并在客户端按筛选条件过滤 + 计算统计。
 *
 * 设计说明：筛选条件（category/status/risk）为客户端下拉框，故采用 SWR 拉取全量
 * 列表后客户端过滤，避免每个筛选组合各发一次请求。SWR cache key 固定为
 * 'GET:/audit-events'（与 server 端 serverRequest 一致），initialEvents 作为无筛选默认值的 fallback。
 */

import { useMemo, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { useQueryLoose, mutate } from '@/hooks/api/use-api';
import type { AuditEvent, AuditFilters, AuditStats } from '../types';

/** SWR 缓存 key（与 useQueryLoose 的 apiName / server 端 serverRequest 一致）。 */
const AUDIT_EVENTS_KEY = 'GET:/audit-events';
const EMPTY_AUDIT_EVENTS: AuditEvent[] = [];

export function useAuditEvents(initialEvents?: AuditEvent[] | undefined) {
  const {
    data,
    isLoading,
    error,
    mutate: refresh,
  } = useQueryLoose<AuditEvent[]>(AUDIT_EVENTS_KEY, { fallback: initialEvents });
  const allEvents = data ?? EMPTY_AUDIT_EVENTS;

  const [filters, setFilters] = useState<AuditFilters>({
    category: 'all',
    status: 'all',
    risk: 'all',
  });

  /** 客户端按筛选条件过滤后的事件列表。 */
  const events = useMemo(() => {
    return allEvents.filter((e) => {
      if (filters.category !== 'all' && String(e.category) !== filters.category) return false;
      if (filters.status !== 'all' && String(e.status) !== filters.status) return false;
      if (filters.risk !== 'all' && String(e.risk) !== filters.risk) return false;
      return true;
    });
  }, [allEvents, filters]);

  /** 统计基于全量列表（与原实现一致），便于在筛选时仍反映整体分布。 */
  const stats = useMemo<AuditStats>(
    () => ({
      total: allEvents.length,
      deployments: count(allEvents, 'category', 'deployment'),
      resourceActions: count(allEvents, 'category', 'resource_action'),
      serviceOperations: count(allEvents, 'category', 'service_operation'),
      backups: count(allEvents, 'category', 'backup'),
      alerts: count(allEvents, 'category', 'alert'),
      logs: count(allEvents, 'category', 'log'),
      highRisk: count(allEvents, 'risk', 'high'),
      failed: allEvents.filter((e) => ['failed', 'blocked'].includes(e.status)).length,
    }),
    [allEvents],
  );

  const setFilter = usePersistFn((key: keyof AuditFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  });

  const reload = usePersistFn(async () => {
    await mutate(AUDIT_EVENTS_KEY);
  });

  return {
    events,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : '加载审计事件失败') : '',
    filters,
    stats,
    setFilter,
    reload,
    refresh,
  };
}

function count(events: AuditEvent[], key: keyof AuditEvent, value: string): number {
  return events.filter((e) => String(e[key]) === value).length;
}
