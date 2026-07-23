'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, MetricCard, Button } from '@/components/ui';
import { useAuditEvents } from '../hooks/use-audit-events';
import { FilterSelect } from './filter-select';
import { EventTable } from './event-table';
import { CategoryDistribution } from './category-distribution';
import type { FilterOption } from '../constants';
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

  // 筛选下拉项随 locale 解析（复用 auditEvents 命名空间既有 i18n 键，避免裸中文）。
  const categoryOptions: FilterOption[] = [
    { value: 'all', label: t('filterAllCategories') },
    { value: 'deployment', label: t('actionDeployment') },
    { value: 'resource_action', label: t('actionResourceAction') },
    { value: 'service_operation', label: t('actionServiceOperation') },
    { value: 'backup', label: t('actionBackup') },
    { value: 'alert', label: t('actionAlert') },
    { value: 'log', label: t('actionLog') },
  ];
  const statusOptions: FilterOption[] = [
    { value: 'all', label: t('filterAllStatuses') },
    { value: 'completed', label: t('statusCompleted') },
    { value: 'failed', label: t('statusFailed') },
    { value: 'blocked', label: t('statusBlocked') },
    { value: 'running', label: t('statusRunning') },
  ];
  const riskOptions: FilterOption[] = [
    { value: 'all', label: t('filterAllRisks') },
    { value: 'low', label: t('riskLow') },
    { value: 'medium', label: t('riskMedium') },
    { value: 'high', label: t('riskHigh') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <Button
            variant="outline"
            onClick={handleRetry}
          >
            {tc('refresh')}
          </Button>
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

      {/* 分类分布（紧凑标签行）与筛选条件合并到同一面板，提升信息密度 */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border p-4">
        <CategoryDistribution stats={stats} />
        <div className="ml-auto flex flex-wrap gap-3">
          <FilterSelect
            label={t('filterCategory')}
            value={filters.category}
            onChange={(v) => setFilter('category', v)}
            options={categoryOptions}
          />
          <FilterSelect
            label={tc('status')}
            value={filters.status}
            onChange={(v) => setFilter('status', v)}
            options={statusOptions}
          />
          <FilterSelect
            label={t('filterRisk')}
            value={filters.risk}
            onChange={(v) => setFilter('risk', v)}
            options={riskOptions}
          />
        </div>
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
