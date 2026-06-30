'use client';

import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, MetricCard } from '@/components/ui';
import { useAuditEvents } from '../hooks/use-audit-events';
import { FilterSelect } from './filter-select';
import { EventTable } from './event-table';
import { CATEGORY_OPTIONS, STATUS_OPTIONS, RISK_OPTIONS } from '../constants';
import type { AuditEvent } from '../types';

/**
 * 审计事件客户端视图。
 *
 * 接收首屏 server 数据 initialEvents（SWR fallback），筛选/刷新等交互在此完成。
 */
export function AuditEventsContent({ initialEvents }: { initialEvents?: AuditEvent[] }) {
  const { events, loading, error, filters, stats, setFilter, reload } =
    useAuditEvents(initialEvents);
  const handleRetry = usePersistFn(() => reload());

  return (
    <div className="space-y-6">
      <PageHeader
        title="审计事件"
        description="查看部署、资源动作和服务运行态操作的统一控制面记录"
        actions={
          <button
            onClick={handleRetry}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            刷新
          </button>
        }
      />

      {error ? (
        <ErrorBanner
          message={error}
          onRetry={handleRetry}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-9">
        <MetricCard
          label="事件总数"
          value={stats.total}
        />
        <MetricCard
          label="部署"
          value={stats.deployments}
        />
        <MetricCard
          label="资源动作"
          value={stats.resourceActions}
        />
        <MetricCard
          label="服务操作"
          value={stats.serviceOperations}
        />
        <MetricCard
          label="备份"
          value={stats.backups}
        />
        <MetricCard
          label="告警"
          value={stats.alerts}
        />
        <MetricCard
          label="日志"
          value={stats.logs}
        />
        <MetricCard
          label="高风险"
          value={stats.highRisk}
        />
        <MetricCard
          label="异常/阻塞"
          value={stats.failed}
        />
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border p-4">
        <FilterSelect
          label="分类"
          value={filters.category}
          onChange={(v) => setFilter('category', v)}
          options={CATEGORY_OPTIONS}
        />
        <FilterSelect
          label="状态"
          value={filters.status}
          onChange={(v) => setFilter('status', v)}
          options={STATUS_OPTIONS}
        />
        <FilterSelect
          label="风险"
          value={filters.risk}
          onChange={(v) => setFilter('risk', v)}
          options={RISK_OPTIONS}
        />
      </div>

      {loading ? (
        <LoadingState text="加载中..." />
      ) : events.length === 0 ? (
        <EmptyState
          text="暂无审计事件"
          description="触发部署、资源动作或服务操作后会在这里出现"
        />
      ) : (
        <EventTable events={events} />
      )}
    </div>
  );
}
