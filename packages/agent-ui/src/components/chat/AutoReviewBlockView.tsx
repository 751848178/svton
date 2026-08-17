import { TimelineStatusIcon } from '../timeline/TimelineStatusIcon';
import { useI18n } from '@svton/ui';

export function AutoReviewBlockView({
  verdict, toolName, reason,
}: { verdict: string; toolName?: string; reason?: string }) {
  const { translate: t } = useI18n();
  const status = verdict === 'approve' ? 'completed' : verdict === 'deny' ? 'failed' : 'warning';
  const color = status === 'completed' ? 'text-status-success' : status === 'failed' ? 'text-destructive' : 'text-status-warning';
  return (
    <div className="my-1 flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
      <TimelineStatusIcon status={status} />
      <span className="text-xs text-foreground">{t('chat.autoReview')}: <span className={color}>{verdict}</span>{toolName && <span className="text-muted-foreground"> · {toolName}</span>}</span>
      {reason && <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{reason}</span>}
    </div>
  );
}
