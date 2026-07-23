'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, MetricCard, Button, Select } from '@/components/ui';
import { useApprovals } from '../hooks/use-approvals';
import { ApprovalCard } from './approval-card';
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

  const statusOptions = [
    { value: 'pending', label: t('statusPending') },
    { value: 'approved', label: t('statusApproved') },
    { value: 'rejected', label: t('statusRejected') },
    { value: 'all', label: t('statusAll') },
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

      {error ? <ErrorBanner message={error} onRetry={handleRetry} /> : null}

      <div className="grid gap-4 md:grid-cols-5">
        <MetricCard label={t('metricCurrentList')} value={stats.total} />
        <MetricCard label={t('metricPending')} value={stats.pending} />
        <MetricCard label={t('metricApproved')} value={stats.approved} />
        <MetricCard label={t('metricRejected')} value={stats.rejected} />
        <MetricCard label={t('metricHighRisk')} value={stats.highRisk} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">{t('filterByStatus')}</span>
        <Select
          className="max-w-xs"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={statusOptions}
        />
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
      )}    </div>
  );
}
