import { useEffect, useId, useRef, useState } from 'react';
import { ChevronIcon, cn, useI18n } from '@svton/ui';

export function ThinkingDisclosure({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  const { translate: t } = useI18n();
  const [open, setOpen] = useState(false);
  const previousStreaming = useRef(isStreaming);
  const contentId = `thinking-${useId().replace(/:/g, '')}`;
  useEffect(() => {
    if (previousStreaming.current && !isStreaming) setOpen(false);
    previousStreaming.current = isStreaming;
  }, [isStreaming]);
  return (
    <div className="mb-2">
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex min-h-11 items-center gap-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground" data-testid="thinking-toggle" aria-expanded={open} aria-controls={contentId}>
        <ChevronIcon size={14} className={cn('transition-transform', open && 'rotate-90')} aria-hidden="true" />
        <span className="italic">{t('chat.thinking')}</span>
      </button>
      {open && <div id={contentId} className="mt-1 max-h-[400px] overflow-y-auto whitespace-pre-wrap border-l-2 border-border pl-4 text-xs italic leading-relaxed text-muted-foreground" data-testid="thinking-content">{text}</div>}
    </div>
  );
}
