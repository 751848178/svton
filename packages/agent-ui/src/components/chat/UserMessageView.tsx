import { useEffect, useRef, useState } from 'react';
import { cn, useI18n } from '@svton/ui';
import { PublicComposerAttachments } from './PublicComposerAttachments';
import type { ChatMessageProps } from './chat-message.types';

type Props = Pick<ChatMessageProps,
  'id' | 'content' | 'images' | 'publicAttachments' | 'onRetry' | 'onEdit' | 'className'>;

export function UserMessageView({
  id, content, images, publicAttachments, onRetry, onEdit, className,
}: Props) {
  const { translate: t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing || !editRef.current) return;
    editRef.current.focus();
    editRef.current.style.height = 'auto';
    editRef.current.style.height = `${Math.min(editRef.current.scrollHeight, 200)}px`;
  }, [editing]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 2000);
    } catch { setCopyState('failed'); }
  };
  const submit = () => {
    const trimmed = editContent.trim();
    if (trimmed && trimmed !== content) onEdit?.(id, trimmed);
    setEditing(false);
  };

  return (
    <div className={cn('group flex justify-end', className)} data-testid="message-user">
      <div className="max-w-[80%] px-6 py-3">
        {editing ? (
          <div className="min-w-0">
            <textarea
              ref={editRef}
              aria-label={t('chat.editMessage')}
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); }
                if (event.key === 'Escape') setEditing(false);
              }}
              className="max-h-[200px] w-full resize-none rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button type="button" onClick={submit} className="min-h-11 min-w-11 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground">{t('chat.send')}</button>
              <button type="button" onClick={() => setEditing(false)} className="min-h-11 min-w-11 rounded-lg border border-border px-3 text-xs text-muted-foreground">{t('chat.cancel')}</button>
              <span className="text-[10px] text-muted-foreground">{t('chat.editHint')}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="min-w-0 rounded-2xl bg-muted px-4 py-2.5">
              <div className="break-words whitespace-pre-wrap text-sm leading-relaxed text-foreground" style={{ overflowWrap: 'anywhere' }}>{content}</div>
              {images && images.length > 0 && <UserImages images={images} />}
              <PublicComposerAttachments attachments={publicAttachments} />
            </div>
            <div data-message-actions className="pointer-events-none mt-1 flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
              <ActionButton title={t('action.copy')} onClick={() => void copy()}>{copyState === 'copied' ? t('action.copied') : copyState === 'failed' ? t('action.copyFailed') : t('action.copy')}</ActionButton>
              {onRetry && <ActionButton title={t('action.retry')} onClick={() => onRetry(id)}>{t('action.retry')}</ActionButton>}
              {onEdit && <ActionButton title={t('chat.editMessage')} onClick={() => { setEditContent(content); setEditing(true); }}>{t('action.edit')}</ActionButton>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ActionButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={title} onClick={onClick} className="min-h-11 min-w-11 rounded-md px-3 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">{children}</button>;
}

function UserImages({ images }: { images: NonNullable<ChatMessageProps['images']> }) {
  return <div className="mt-2 flex flex-wrap gap-2">{images.map((image, index) => <img key={`${image.data.slice(0, 20)}:${index}`} src={image.data.startsWith('data:') || image.data.startsWith('http') ? image.data : `data:${image.mimeType || 'image/png'};base64,${image.data}`} alt={`User attachment ${index + 1}`} className="max-h-48 max-w-xs rounded-lg border border-border" />)}</div>;
}
