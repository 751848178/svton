import { cn, useI18n } from '@svton/ui';
import type { ChatMessageProps } from './chat-message.types';

type Props = Pick<ChatMessageProps, 'content' | 'systemType' | 'className'>;

export function SystemMessageView({ content, systemType, className }: Props) {
  const { translate: t } = useI18n();
  if (systemType === 'context_compacted') {
    return (
      <div className={cn('flex items-center justify-center gap-2 px-6 py-2', className)}>
        <span className="h-px w-6 bg-border" aria-hidden="true" />
        <span className="text-[11px] text-muted-foreground">{t('chat.contextCompacted')}</span>
        <span className="h-px w-6 bg-border" aria-hidden="true" />
      </div>
    );
  }
  return <div className={cn('px-6 py-2 text-center text-xs text-muted-foreground', className)}>{content}</div>;
}
