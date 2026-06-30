/**
 * 操作审批数据 Hook
 *
 * 单一职责：审批列表获取（按状态筛选）、审批决策、已批准执行。
 * 执行编排委托 approval-executor.service。
 *
 * 列表走 SWR（useQueryLoose），key 编码 status 筛选；首屏 server 数据 initialApprovals
 * 仅作为默认（pending）视图的 fallback。
 */

import { useMemo, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { useQueryLoose, mutate } from '@/hooks/api/use-api';
import { executeApproved } from '../services/approval-executor.service';
import type { OperationApproval, ApprovalDecision, ApprovalStats } from '../types';

/** 默认状态（与 server 首屏取数一致），用于匹配 initialApprovals fallback。 */
const DEFAULT_STATUS = 'pending';

/** SWR key：编码 status,以便切换筛选时重新取数。 */
function approvalsKey(status: string): string {
  return status === 'all' ? 'GET:/operation-approvals' : `GET:/operation-approvals?status=${status}`;
}

export function useApprovals(initialApprovals?: OperationApproval[]) {
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [actingId, setActingId] = useState('');
  const [error, setError] = useState('');

  // 仅默认视图使用 server 下发的 initialApprovals 作为 fallback。
  const fallback = status === DEFAULT_STATUS ? initialApprovals : undefined;

  const { data, isLoading, mutate: refresh } = useQueryLoose<OperationApproval[]>(
    approvalsKey(status),
    { fallback },
  );
  const approvals = data ?? [];

  const stats = useMemo<ApprovalStats>(
    () => ({
      total: approvals.length,
      pending: count(approvals, 'status', 'pending'),
      approved: count(approvals, 'status', 'approved'),
      rejected: count(approvals, 'status', 'rejected'),
      highRisk: count(approvals, 'risk', 'high'),
    }),
    [approvals],
  );

  const review = usePersistFn(async (approval: OperationApproval, decision: ApprovalDecision) => {
    setActingId(`${approval.id}:${decision}`);
    setError('');
    try {
      await apiRequest(`/operation-approvals/${approval.id}/review`, {
        decision,
        reviewComment: decision === 'approved' ? '同意执行' : '拒绝执行',
      });
      await mutate(approvalsKey(status));
    } catch (err) {
      setError(err instanceof Error ? err.message : '审批操作失败');
    } finally {
      setActingId('');
    }
  });

  const execute = usePersistFn(async (approval: OperationApproval) => {
    setActingId(`${approval.id}:execute`);
    setError('');
    try {
      await executeApproved(approval);
      await mutate(approvalsKey(status));
    } catch (err) {
      setError(err instanceof Error ? err.message : '执行已批准操作失败');
    } finally {
      setActingId('');
    }
  });

  const reload = usePersistFn(() => refresh());

  return {
    approvals,
    status,
    setStatus,
    loading: isLoading,
    actingId,
    error,
    stats,
    review,
    execute,
    reload,
  };
}

function count(items: OperationApproval[], key: keyof OperationApproval, value: string): number {
  return items.filter((i) => String(i[key]) === value).length;
}
