'use client';

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
  const { approvals, status, setStatus, loading, actingId, error, stats, review, execute, reload } =
    useApprovals(initialApprovals);
  const handleRetry = usePersistFn(() => reload());

  return (
    <div className="space-y-6">
      <PageHeader
        title="操作审批"
        description="审批资源动作、服务操作、部署和站点同步/回滚的 live 执行申请"
        actions={
          <button
            onClick={handleRetry}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            刷新
          </button>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={handleRetry} /> : null}

      <div className="grid gap-4 md:grid-cols-5">
        <MetricCard label="当前列表" value={stats.total} />
        <MetricCard label="待审批" value={stats.pending} />
        <MetricCard label="已批准" value={stats.approved} />
        <MetricCard label="已拒绝" value={stats.rejected} />
        <MetricCard label="高风险" value={stats.highRisk} />
      </div>

      <div className="rounded-lg border p-4">
        <label className="block max-w-xs text-sm">
          <span className="mb-1 block font-medium">状态</span>
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
        <LoadingState text="加载中..." />
      ) : approvals.length === 0 ? (
        <EmptyState
          text="暂无操作审批"
          description="申请 live 执行资源动作、服务操作、部署或站点操作后会在这里出现"
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
