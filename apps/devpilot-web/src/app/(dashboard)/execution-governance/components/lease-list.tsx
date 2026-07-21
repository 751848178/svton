/**
 * Live 占用列表
 *
 * 单一职责：渲染 ServerExecutionLease 表格 + 状态筛选。
 */

'use client';

import { useTranslations } from 'next-intl';
import { LoadingState, EmptyState } from '@svton/ui';
import { MetricCard } from '@/components/ui';
import { CollapsibleGroup } from './collapsible-group';
import { StatusBadge } from './ui-bits';
import type { ServerExecutionLease } from '../types';
import type { LeaseStats } from '../hooks/use-execution-governance';
import { readBlockedBy, formatDate } from '../utils';

interface LeaseListProps {
  leases: ServerExecutionLease[];
  loading: boolean;
  leaseStatus: string;
  onLeaseStatusChange: (status: string) => void;
  stats: LeaseStats;
}

export function LeaseList({
  leases,
  loading,
  leaseStatus,
  onLeaseStatusChange,
  stats,
}: LeaseListProps) {
  const t = useTranslations('executionGovernance');
  const tc = useTranslations('common');
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t('leaseListTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('leaseListSubtitle')}</p>
        </div>
        <label className="block w-44 text-sm">
          <span className="mb-1 block font-medium">{tc('status')}</span>
          <select
            value={leaseStatus}
            onChange={(e) => onLeaseStatusChange(e.target.value)}
            className="min-h-11 w-full rounded-md border px-3"
          >
            <option value="running">{t('statusRunning')}</option>
            <option value="blocked">{t('statusBlocked')}</option>
            <option value="completed">{t('statusCompleted')}</option>
            <option value="failed">{tc('failed')}</option>
            <option value="expired">{t('statusExpired')}</option>
            <option value="all">{tc('all')}</option>
          </select>
        </label>
      </div>

      <CollapsibleGroup
        title={t('groupLeases')}
        issueCount={stats.expired + stats.failed}
      >
        <div className="grid gap-4 md:grid-cols-5">
          <MetricCard
            label={t('metricCurrentList')}
            value={stats.total}
          />
          <MetricCard
            label={t('statusRunning')}
            value={stats.running}
          />
          <MetricCard
            label={t('statusBlocked')}
            value={stats.blocked}
          />
          <MetricCard
            label={t('statusExpired')}
            value={stats.expired}
          />
          <MetricCard
            label={tc('failed')}
            value={stats.failed}
          />
        </div>
      </CollapsibleGroup>

      {loading ? (
        <LoadingState text={tc('loading')} />
      ) : leases.length === 0 ? (
        <EmptyState
          text={t('noLeases')}
          description={t('noLeasesHint')}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-[920px] w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">{tc('status')}</th>
                <th className="px-4 py-3 font-medium">{t('colServer')}</th>
                <th className="px-4 py-3 font-medium">{tc('actions')}</th>
                <th className="px-4 py-3 font-medium">{t('colExecutor')}</th>
                <th className="px-4 py-3 font-medium">{t('colApplicant')}</th>
                <th className="px-4 py-3 font-medium">{tc('createdAt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leases.map((lease) => (
                <tr key={lease.id}>
                  <td className="px-4 py-3">
                    <StatusBadge status={lease.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{lease.server?.name || t('noServer')}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {lease.server?.host || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{lease.operationKey}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {readBlockedBy(lease.metadata)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{lease.adapterKey}</div>
                    <div className="text-xs text-muted-foreground">{lease.transport}</div>
                  </td>
                  <td className="px-4 py-3">{lease.actor?.name || lease.actor?.email || '-'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div>{t('timeAcquired', { value: formatDate(lease.acquiredAt) })}</div>
                    <div>{t('timeReleased', { value: formatDate(lease.releasedAt) })}</div>
                    <div>{t('timeExpires', { value: formatDate(lease.expiresAt) })}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
