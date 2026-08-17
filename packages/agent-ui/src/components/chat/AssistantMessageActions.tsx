import { useCallback, useState } from 'react';
import { cn, useI18n } from '@svton/ui';
import type { ArtifactTarget } from '../artifacts/artifact.types';
import { assistantDocumentTitle } from './message-rendering.utils';

export function AssistantMessageActions({
  content, isLast, onRetry, onOpenEditor, onArtifactOpen, artifactId,
}: {
  content: string;
  isLast?: boolean;
  onRetry?: (messageId?: string) => void;
  onOpenEditor?: (content: string) => void;
  onArtifactOpen?: (target: ArtifactTarget) => void;
  artifactId: string;
}) {
  const { translate: t } = useI18n();
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus('copied');
      window.setTimeout(() => setCopyStatus('idle'), 2000);
    } catch { setCopyStatus('failed'); }
  }, [content]);
  return (
    <div data-message-actions className={cn(
      'ml-5 mt-2 flex items-center gap-1 transition-opacity',
      isLast
        ? 'opacity-100'
        : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100',
    )}>
      <Action title={t('action.copy')} onClick={() => void copy()}>{copyStatus === 'copied' ? t('action.copied') : copyStatus === 'failed' ? t('action.copyFailed') : t('action.copy')}</Action>
      {(onArtifactOpen || onOpenEditor) && (
        <Action title={t('action.openContentPanel')} onClick={() => onArtifactOpen
          ? onArtifactOpen({ kind: 'document', id: artifactId, title: assistantDocumentTitle(content, t('chat.assistantResponseTitle')), format: 'markdown', content })
          : onOpenEditor?.(content)}>
          {t('action.openContentPanel')}
        </Action>
      )}
      {onRetry && isLast && <Action title={t('action.retry')} onClick={() => onRetry()}>{t('action.retry')}</Action>}
    </div>
  );
}

function Action({ title, onClick, children }: {
  title: string; onClick: () => void; children: React.ReactNode;
}) {
  return <button type="button" title={title} onClick={onClick} className="min-h-11 min-w-11 rounded-md px-3 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">{children}</button>;
}
