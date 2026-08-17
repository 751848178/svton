import { ChevronIcon, cn, useI18n } from '@svton/ui';
import { ActivityIndicator } from './ActivityIndicator';
import { formatMessageDuration } from './message-rendering.utils';

export function AssistantProcessToggle({
  expanded, isStreaming, duration, activeSkills, onToggle,
}: {
  expanded: boolean;
  isStreaming?: boolean;
  duration?: number;
  activeSkills?: string[];
  onToggle: () => void;
}) {
  const { translate: t } = useI18n();
  if (!expanded && isStreaming) {
    return (
      <button type="button" onClick={onToggle} aria-expanded="false" title={t('chat.expandProcess')} className="min-h-11 w-full rounded-lg text-left">
        <ActivityIndicator activeSkills={activeSkills} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      title={expanded ? t('chat.collapseProcess') : t('chat.expandProcess')}
      className="mb-2 flex min-h-11 w-full items-center gap-2 rounded-lg text-left text-xs text-muted-foreground hover:text-foreground"
    >
      <ChevronIcon size={14} className={cn('transition-transform', expanded && 'rotate-90')} aria-hidden="true" />
      <span>{t('chat.processed')}</span>
      {duration != null && <span>{formatMessageDuration(duration)}</span>}
    </button>
  );
}
