import React from 'react';
import { cn, useI18n } from '@svton/ui';
import { localizeSessionActivity } from './session-activity-copy';

export interface SessionActivityIndicatorModel {
  phase: string;
  isUnread: boolean;
  statusLabel: string;
  statusDescription: string;
}

export function SessionActivityIndicator({
  sessionId,
  activity,
  announce = true,
  className,
}: {
  sessionId: string;
  activity?: SessionActivityIndicatorModel;
  announce?: boolean;
  className?: string;
}) {
  const { translate: t } = useI18n();
  if (!activity || (activity.phase === 'idle' && !activity.isUnread)) return null;
  const { statusLabel, statusDescription } = localizeSessionActivity(activity, t);
  const unread = t('session.activity.unread');
  const label = `${statusLabel}${activity.isUnread ? `, ${unread}` : ''}`;
  return (
    <span
      role={announce ? 'status' : undefined}
      aria-label={label}
      title={statusDescription}
      data-testid={`session-activity-${sessionId}`}
      data-phase={activity.phase}
      data-unread={activity.isUnread ? 'true' : 'false'}
      className={cn(
        'shrink-0 rounded border border-[#3a3a3a] px-1.5 py-0.5 text-[9px] leading-none text-gray-400',
        activity.isUnread && 'border-cyan-700 text-cyan-300',
        className,
      )}
    >
      {statusLabel}{activity.isUnread ? ` ${unread}` : ''}
    </span>
  );
}
