import { useI18n, type Translator } from '@svton/ui';

export interface PublicComposerAttachmentView {
  id: string;
  kind: 'file' | 'skill' | 'mention';
  name: string;
  path?: string;
  mentionType?: 'file' | 'folder' | 'tool';
}

export function PublicComposerAttachments({ attachments }: {
  attachments: PublicComposerAttachmentView[] | undefined;
}) {
  const { translate: t } = useI18n();
  if (!attachments?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" aria-label={t('chat.attachment.sent')}>
      {attachments.map((item) => (
        <span
          key={item.id}
          className="max-w-full rounded-md border border-[#444] bg-[#242424] px-2 py-1 text-[10px] text-gray-300"
          title={item.path ?? item.name}
          data-attachment-path={item.path}
        >
          <span className="block"><span className="mr-1 text-gray-500">{label(item, t)}</span>{item.name}</span>
          <span className="block break-all text-gray-500">{item.path ?? t('chat.attachment.localFile')}</span>
        </span>
      ))}
    </div>
  );
}

function label(item: PublicComposerAttachmentView, t: Translator) {
  if (item.kind === 'file') return t('chat.attachment.file');
  if (item.kind === 'skill') return t('chat.attachment.skill');
  return t(item.mentionType === 'tool' ? 'chat.attachment.tool' : 'chat.attachment.reference');
}
