import type { ComposerAttachment } from './composer.types';
import { useI18n } from '@svton/ui';

export function ComposerAttachments({ attachments, onRemove }: {
  attachments: ComposerAttachment[];
  onRemove: (id: string) => void;
}) {
  const { translate: t } = useI18n();
  if (!attachments.length) return null;
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2" aria-label={t('chat.attachment.draft')}>
      {attachments.map((attachment) => attachment.kind === 'image' ? (
        <div key={attachment.id} className="relative h-16 w-16 overflow-hidden rounded-lg border border-[#383838] bg-[#222]">
          <img
            src={`data:${attachment.mimeType};base64,${attachment.data}`}
            alt={attachment.name}
            className="h-full w-full object-cover"
          />
          <RemoveButton label={t('chat.attachment.remove', { name: attachment.name })} text={t('action.remove')} onClick={() => onRemove(attachment.id)} compact />
        </div>
      ) : (
        <div
          key={attachment.id}
          className="flex min-h-9 max-w-full items-center gap-2 rounded-lg border border-[#383838] bg-[#222] px-2.5 py-1.5 text-xs"
          data-attachment-path={attachment.path}
        >
          <span className="text-[10px] uppercase text-gray-500">
            {t(attachment.kind === 'file'
              ? 'chat.attachment.file'
              : attachment.kind === 'skill' ? 'chat.attachment.skill' : 'chat.attachment.reference')}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-gray-200">{attachment.name}</span>
            <span className="block truncate text-[10px] text-gray-500">{attachment.path ?? t('chat.attachment.localFile')}</span>
          </span>
          <RemoveButton label={t('chat.attachment.remove', { name: attachment.name })} text={t('action.remove')} onClick={() => onRemove(attachment.id)} />
        </div>
      ))}
    </div>
  );
}

function RemoveButton({ label, text, onClick, compact = false }: {
  label: string;
  text: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={compact
        ? 'absolute right-0 top-0 flex min-h-9 min-w-9 items-center justify-center rounded-bl-md bg-black/70 px-1 text-[10px] text-white hover:bg-black/90'
        : 'ml-auto flex min-h-9 flex-shrink-0 items-center justify-center rounded-md px-2 text-[10px] text-gray-400 hover:bg-[#333] hover:text-white'}
    >
      {text}
    </button>
  );
}
