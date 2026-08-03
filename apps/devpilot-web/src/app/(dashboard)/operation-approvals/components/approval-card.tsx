/**
 * 审批卡片
 *
 * 单一职责：渲染单个审批 + 状态/风险徽章 + 决策/执行操作。
 * 驳回理由收集委托 RejectReasonModal（必填,合规留痕）；approved 保持快捷通过。
 */

'use client';

import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type { OperationApproval, ApprovalDecision } from '../types';
import { categoryLabels, statusLabels, riskLabels, actionLabels } from '../constants';
import { formatTarget, formatDateTime, humanizeAction } from '../utils';
import { RejectReasonModal } from './reject-reason-modal';
import { ApprovalDecisionContext } from './approval-decision-context';

interface ApprovalCardProps {
  approval: OperationApproval;
  currentUserId?: string;
  actingId: string;
  onReview: (approval: OperationApproval, decision: ApprovalDecision, comment?: string) => void;
  onExecute: (approval: OperationApproval) => void;
}

export function ApprovalCard({
  approval,
  currentUserId,
  actingId,
  onReview,
  onExecute,
}: ApprovalCardProps) {
  const t = useTranslations('operationApprovals');
  const [decision, setDecision] = useState<ApprovalDecision | null>(null);
  const handleApprove = usePersistFn(() => setDecision('approved'));
  const handleReject = usePersistFn(() => setDecision('rejected'));
  const handleExecute = usePersistFn(() => onExecute(approval));
  const handleCloseReview = usePersistFn(() => setDecision(null));
  const handleConfirmReview = usePersistFn((comment: string) => {
    if (!decision) return;
    onReview(approval, decision, comment);
    setDecision(null);
  });

  const actionLabel = humanizeAction(approval.action, actionLabels);
  const isSelfApproval = Boolean(
    currentUserId && approval.requesterId && currentUserId === approval.requesterId,
  );

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{approval.summary || actionLabel}</h3>
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
            {categoryLabels[approval.category] || approval.category} · {actionLabel}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {t('target', { target: formatTarget(approval) })}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t('projectEnv', {
              project: approval.project?.name || t('notAssociated'),
              environment:
                approval.environment?.name || approval.environment?.key || t('notAssociated'),
            })}
          </div>
          {approval.reason ? (
            <div className="mt-2 rounded-md bg-muted/50 p-2 text-sm">
              <span className="text-xs text-muted-foreground">{t('requesterReason')}</span>
              <div className="mt-0.5">{approval.reason}</div>
            </div>
          ) : null}
          {approval.reviewComment ? (
            <div className="mt-2 rounded-md bg-muted/30 p-2 text-sm">
              <span className="text-xs text-muted-foreground">{t('reviewerComment')}</span>
              <div className="mt-0.5">{approval.reviewComment}</div>
            </div>
          ) : null}
          <ApprovalDecisionContext approval={approval} />
          <div className="mt-2 text-xs text-muted-foreground">
            {t('requester', { name: approval.requester?.name || approval.requester?.email || '-' })}{' '}
            · {t('requestedAt', { date: formatDateTime(approval.requestedAt) })}
            {approval.reviewer
              ? ` · ${t('reviewer', { name: approval.reviewer.name || approval.reviewer.email })}`
              : ''}
            {approval.consumedAt
              ? ` · ${t('consumed', { date: formatDateTime(approval.consumedAt) })}`
              : ''}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {approval.status === 'pending' ? (
            <div className="space-y-1">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleApprove}
                  disabled={Boolean(actingId) || isSelfApproval}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                >
                  {actingId === `${approval.id}:approved` ? t('processing') : t('approve')}
                </button>
                <button
                  onClick={handleReject}
                  disabled={Boolean(actingId) || isSelfApproval}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                >
                  {actingId === `${approval.id}:rejected` ? t('processing') : t('reject')}
                </button>
              </div>
              {isSelfApproval && (
                <p className="max-w-48 text-xs text-amber-700">{t('selfApprovalBlocked')}</p>
              )}
            </div>
          ) : null}
          {approval.status === 'approved' && !approval.consumedAt ? (
            <button
              onClick={handleExecute}
              disabled={Boolean(actingId)}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              {actingId === `${approval.id}:execute` ? t('executing') : t('executeApproved')}
            </button>
          ) : null}
        </div>
      </div>
      <RejectReasonModal
        open={decision !== null}
        variant={decision ?? 'rejected'}
        onClose={handleCloseReview}
        onConfirm={handleConfirmReview}
        submitting={Boolean(decision && actingId === `${approval.id}:${decision}`)}
      />
    </div>
  );
}
