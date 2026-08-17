import React from 'react';
import { TimelineStatusIcon } from './TimelineStatusIcon';
import type { ApprovalDecisionItemView as ApprovalItem } from './timeline.types';
import { useI18n, type TranslationKey } from '@svton/ui';
import { approvalTitle } from './timeline-execution-copy';
import { timelineStatusKey } from './timeline-status-copy';

const LABELS: Record<NonNullable<ApprovalItem['decision']>, TranslationKey> = {
  accept: 'approval.history.allowedOnce',
  acceptForSession: 'approval.history.allowedSession',
  decline: 'approval.history.declined',
  cancel: 'approval.history.cancelled',
  interrupted: 'approval.history.interrupted',
};

/** Always-visible approval request/history row; live actions remain modal-owned. */
export function ApprovalDecisionItemView({ item }: { item: ApprovalItem }) {
  const { translate: t } = useI18n();
  const pending = item.status === 'awaitingApproval';
  return (
    <article
      aria-live="off"
      className="mx-6 my-2 rounded-lg border border-status-warning/40 bg-status-warning/10 px-3 py-2"
      data-testid="approval-decision-history"
      data-status={item.status}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-foreground">{approvalTitle(item.toolName, t)}</span>
        <span className="flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-wide text-status-warning">
          <TimelineStatusIcon status={item.status} />
          {pending
            ? t('approval.history.waiting')
            : item.decision ? t(LABELS[item.decision]) : t(timelineStatusKey(item.status))}
        </span>
      </div>
      {item.reason && <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>}
    </article>
  );
}
