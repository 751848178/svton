'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, MetricCard } from '@/components/ui';
import { useAuditEvents } from '../hooks/use-audit-events';
import { FilterSelect } from './filter-select';
import { EventTable } from './event-table';
import { CategoryDistribution } from './category-distribution';
import { CATEGORY_OPTIONS, STATUS_OPTIONS, RISK_OPTIONS } from '../constants';
import type { AuditEvent } from '../types';

/**
 * 审计事件客户端视图。
 *
 * 接收首屏 server 数据 initialEvents（SWR fallback），筛选/刷新等交互在此完成。
 */
export function AuditEventsContent({ initialEvents }: { initialEvents?: AuditEvent[] }) {
  const t = useTranslations('auditEvents');
  const tc = useTranslations('common');
  const { events, loading, error, filters, stats, setFilter, reload } =
    useAuditEvents(initialEvents);
  const handleRetry = usePersistFn(() => reload());

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <button
            onClick={handleRetry}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            {tc('refresh')}
          </button>
        }
      />

      {error ? (
        <ErrorBanner
          message={error}
          onRetry={handleRetry}
        />
      ) : null}

      {/* 聚合卡：总量 / 失败（含阻塞） / 高危 / 告警；分类明细见下方分布区块 */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t('metricTotal')}
          value={stats.total}
        />
        <MetricCard
          label={t('metricFailed')}
          value={stats.failed}
        />
        <MetricCard
          label={t('metricHighRisk')}
          value={stats.highRisk}
        />
        <MetricCard
          label={t('metricAlerts')}
          value={stats.alerts}
        />
      </div>

      <CategoryDistribution stats={stats} />

      <div className="flex flex-wrap gap-3 rounded-lg border p-4">
        <FilterSelect
          label={t('filterCategory')}
          value={filters.category}
          onChange={(v) => setFilter('category', v)}
          options={CATEGORY_OPTIONS}
        />
        <FilterSelect
          label={tc('status')}
          value={filters.status}
          onChange={(v) => setFilter('status', v)}
          options={STATUS_OPTIONS}
        />
        <FilterSelect
          label={t('filterRisk')}
          value={filters.risk}
          onChange={(v) => setFilter('risk', v)}
          options={RISK_OPTIONS}
        />
      </div>

      {loading ? (
        <LoadingState text={tc('loading')} />
      ) : events.length === 0 ? (
        <EmptyState
          text={t('noEvents')}
          description={t('noEventsHint')}
        />
      ) : (
        <EventTable events={events} />
      )}
    </div>
  );
}
