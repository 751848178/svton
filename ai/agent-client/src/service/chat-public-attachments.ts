import type { PublicComposerAttachment } from './chat-prepared-input.types';

export function serializePublicAttachments(
  attachments: PublicComposerAttachment[] | undefined,
): PublicComposerAttachment[] | undefined {
  return attachments?.length ? attachments.slice(0, 32).map((item) => ({ ...item })) : undefined;
}

export function deserializePublicAttachments(value: unknown): PublicComposerAttachment[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const attachments = value.slice(0, 32).flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Record<string, unknown>;
    if (!isText(item.id, 300) || !isText(item.name, 300)) return [];
    if (item.kind !== 'file' && item.kind !== 'skill' && item.kind !== 'mention') return [];
    if (item.kind === 'file' && item.path !== undefined && !isText(item.path, 4_000)) return [];
    if (item.kind !== 'file' && !isText(item.path, 4_000)) return [];
    if (item.kind === 'mention' && item.mentionType !== 'file' && item.mentionType !== 'folder' && item.mentionType !== 'tool') return [];
    return [{
      id: item.id,
      kind: item.kind,
      name: item.name,
      ...(typeof item.path === 'string' ? { path: item.path } : {}),
      ...(item.kind === 'mention' ? { mentionType: item.mentionType } : {}),
    } as PublicComposerAttachment];
  });
  return attachments.length ? attachments : undefined;
}

function isText(value: unknown, max: number): value is string {
  return typeof value === 'string' && Array.from(value).length > 0 && Array.from(value).length <= max;
}
