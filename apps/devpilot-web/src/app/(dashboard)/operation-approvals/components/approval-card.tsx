/**
 * 审批卡片
 *
 * 单一职责：渲染单个审批 + 状态/风险徽章 + 决策/执行操作。
 */

'use client';

import { usePersistFn } from '@svton/hooks';
import { useTranslations } from 'next-intl';
import { StatusTag, CodeBlock } from '@/components/ui';
import type { OperationApproval, ApprovalDecision } from '../types';
import { categoryLabels, statusLabels, riskLabels, actionLabels } from '../constants';
import {
  formatTarget,
  formatDateTime,
  readMetadataString,
  humanizeAction,
} from '../utils';

interface ApprovalCardProps {
  approval: OperationApproval;
  actingId: string;
  onReview: (approval: OperationApproval, decision: ApprovalDecision) => void;
  onExecute: (approval: OperationApproval) => void;
}

export function ApprovalCard({ approval, actingId, onReview, onExecute }: ApprovalCardProps) {
  const t = useTranslations('operationApprovals');
  const handleApprove = usePersistFn(() => onReview(approval, 'approved'));
  const handleReject = usePersistFn(() => onReview(approval, 'rejected'));
  const handleExecute = usePersistFn(() => onExecute(approval));

  const diffSummary = readMetadataString(approval.metadata, 'diffSummary');
  const actionLabel = humanizeAction(approval.action, actionLabels);

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
          <div className="mt-1 text-sm text-muted-foreground">{t('target', { target: formatTarget(approval) })}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t('projectEnv', {
              project: approval.project?.name || t('notAssociated'),
              environment: approval.environment?.name || approval.environment?.key || t('notAssociated'),
            })}
          </div>
          {approval.reason ? (
            <div className="mt-2 rounded-md bg-muted/50 p-2 text-sm">{approval.reason}</div>
          ) : null}
          {diffSummary ? (
            <CodeBlock
              tone="muted"
              content={diffSummary}
              className="mt-2"
            />
          ) : null}
          <div className="mt-2 text-xs text-muted-foreground">
            {t('requester', { name: approval.requester?.name || approval.requester?.email || '-' })}{' '}
            ·{' '}
            {t('requestedAt', { date: formatDateTime(approval.requestedAt) })}
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
            <>
              <button
                onClick={handleApprove}
                disabled={Boolean(actingId)}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              >
                {actingId === `${approval.id}:approved` ? t('processing') : t('approve')}
              </button>
              <button
                onClick={handleReject}
                disabled={Boolean(actingId)}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              >
                {actingId === `${approval.id}:rejected` ? t('processing') : t('reject')}
              </button>
            </>
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
    </div>
  );
}
