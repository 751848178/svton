'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, MetricCard } from '@/components/ui';
import { useApprovals } from '../hooks/use-approvals';
import { ApprovalCard } from './approval-card';
import { STATUS_OPTIONS } from '../constants';
import type { OperationApproval } from '../types';

/**
 * 操作审批客户端视图。
 *
 * 接收首屏 server 数据 initialApprovals（默认 pending 视图的 SWR fallback）。
 * 状态筛选、审批决策、已批准执行等交互在此完成。
 */
export function ApprovalsContent({ initialApprovals }: { initialApprovals?: OperationApproval[] }) {
  const t = useTranslations('operationApprovals');
  const tc = useTranslations('common');
  const { approvals, status, setStatus, loading, actingId, error, stats, review, execute, reload } =
    useApprovals(initialApprovals);
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

      {error ? <ErrorBanner message={error} onRetry={handleRetry} /> : null}

      <div className="grid gap-4 md:grid-cols-5">
        <MetricCard label={t('metricCurrentList')} value={stats.total} />
        <MetricCard label={t('metricPending')} value={stats.pending} />
        <MetricCard label={t('metricApproved')} value={stats.approved} />
        <MetricCard label={t('metricRejected')} value={stats.rejected} />
        <MetricCard label={t('metricHighRisk')} value={stats.highRisk} />
      </div>

      <div className="rounded-lg border p-4">
        <label className="block max-w-xs text-sm">
          <span className="mb-1 block font-medium">{tc('status')}</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <LoadingState text={tc('loading')} />
      ) : approvals.length === 0 ? (
        <EmptyState
          text={t('noApprovals')}
          description={t('noApprovalsHint')}
        />
      ) : (
        <div className="grid gap-4">
          {approvals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              actingId={actingId}
              onReview={review}
              onExecute={execute}
            />
          ))}
        </div>
      )}
    </div>
  );
}
