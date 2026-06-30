/**
 * 审批卡片
 *
 * 单一职责：渲染单个审批 + 状态/风险徽章 + 决策/执行操作。
 */

import { usePersistFn } from '@svton/hooks';
import { StatusTag } from '@/components/ui';
import type { OperationApproval, ApprovalDecision } from '../types';
import { categoryLabels, statusLabels, riskLabels } from '../constants';
import { formatTarget, formatDateTime, readMetadataString } from '../utils';

interface ApprovalCardProps {
  approval: OperationApproval;
  actingId: string;
  onReview: (approval: OperationApproval, decision: ApprovalDecision) => void;
  onExecute: (approval: OperationApproval) => void;
}

export function ApprovalCard({ approval, actingId, onReview, onExecute }: ApprovalCardProps) {
  const handleApprove = usePersistFn(() => onReview(approval, 'approved'));
  const handleReject = usePersistFn(() => onReview(approval, 'rejected'));
  const handleExecute = usePersistFn(() => onExecute(approval));

  const diffSummary = readMetadataString(approval.metadata, 'diffSummary');

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{approval.summary || approval.action}</h3>
            <StatusTag
              status={approval.status}
              label={statusLabels[approval.status] || approval.status}
            />
            <StatusTag
              status={approval.risk}
              variant="risk"
              label={riskLabels[approval.risk] || approval.risk}
            />
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {categoryLabels[approval.category] || approval.category} · {approval.action}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">目标：{formatTarget(approval)}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            项目：{approval.project?.name || '未关联'} · 环境：
            {approval.environment?.name || approval.environment?.key || '未关联'}
          </div>
          {approval.reason ? (
            <div className="mt-2 rounded-md bg-muted/50 p-2 text-sm">{approval.reason}</div>
          ) : null}
          {diffSummary ? (
            <div className="mt-2 rounded-md bg-muted/50 p-2 font-mono text-xs">{diffSummary}</div>
          ) : null}
          <div className="mt-2 text-xs text-muted-foreground">
            申请人：{approval.requester?.name || approval.requester?.email || '-'} · 申请时间：
            {formatDateTime(approval.requestedAt)}
            {approval.reviewer
              ? ` · 审批人：${approval.reviewer.name || approval.reviewer.email}`
              : ''}
            {approval.consumedAt ? ` · 已消费：${formatDateTime(approval.consumedAt)}` : ''}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {approval.status === 'pending' ? (
            <>
              <button
                onClick={handleApprove}
                disabled={Boolean(actingId)}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              >
                {actingId === `${approval.id}:approved` ? '处理中...' : '批准'}
              </button>
              <button
                onClick={handleReject}
                disabled={Boolean(actingId)}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              >
                {actingId === `${approval.id}:rejected` ? '处理中...' : '拒绝'}
              </button>
            </>
          ) : null}
          {approval.status === 'approved' && !approval.consumedAt ? (
            <button
              onClick={handleExecute}
              disabled={Boolean(actingId)}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              {actingId === `${approval.id}:execute` ? '执行中...' : '执行已批准'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
