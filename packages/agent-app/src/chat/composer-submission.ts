import {
  MAX_COMPOSER_FILE_BYTES,
  MAX_COMPOSER_FILE_CODEPOINTS,
  type ComposerDraft,
  type ComposerFileAdapter,
  type ComposerSubmission,
  type ResolvedComposerInput,
} from '@svton/agent-ui';
import type { ChatPreparedInput, PublicComposerAttachment } from '@svton/agent-client';
import type { Translator } from '@svton/ui';

export type SubmissionBuildResult =
  | { kind: 'succeeded'; submission: ComposerSubmission }
  | { kind: 'failed'; message: string };

export async function buildComposerSubmission(
  draft: ComposerDraft,
  fileAdapter: ComposerFileAdapter | undefined,
  t: Translator,
): Promise<SubmissionBuildResult> {
  const inputs: ResolvedComposerInput[] = [];
  for (const attachment of draft.attachments) {
    if (attachment.kind === 'file') {
      const resolved = await resolveFile(attachment, fileAdapter, t);
      if (resolved.kind === 'failed') return resolved;
      inputs.push({ kind: 'file', attachment, text: resolved.text });
    } else if (attachment.kind === 'image') {
      inputs.push({ kind: 'image', attachment });
    } else if (attachment.kind === 'skill') {
      inputs.push({ kind: 'skill', attachment });
    } else {
      inputs.push({ kind: 'mention', attachment });
    }
  }
  return { kind: 'succeeded', submission: { text: draft.text, inputs } };
}

async function resolveFile(
  attachment: Extract<ComposerDraft['attachments'][number], { kind: 'file' }>,
  fileAdapter: ComposerFileAdapter | undefined,
  t: Translator,
): Promise<{ kind: 'succeeded'; text: string } | { kind: 'failed'; message: string }> {
  if (attachment.size > MAX_COMPOSER_FILE_BYTES) {
    return { kind: 'failed', message: t('chat.interaction.fileTooLargeKept', { name: attachment.name }) };
  }
  if (!fileAdapter?.capability.supported) {
    return { kind: 'failed', message: t('chat.interaction.fileUnreadableKept') };
  }
  const read = await fileAdapter.readText(attachment);
  if (read.kind === 'failed') return read;
  if (read.text.includes('\0')) {
    return { kind: 'failed', message: t('chat.interaction.fileBinaryKept', { name: attachment.name }) };
  }
  if (Array.from(read.text).length > MAX_COMPOSER_FILE_CODEPOINTS) {
    return { kind: 'failed', message: t('chat.interaction.fileTextTooLongKept', { name: attachment.name }) };
  }
  return { kind: 'succeeded', text: read.text };
}

export function prepareChatInput(submission: ComposerSubmission): ChatPreparedInput {
  const publicAttachments = submission.inputs.flatMap((input) => {
    const item = toPublicAttachment(input);
    return item ? [item] : [];
  });
  return {
    publicContent: submission.text.trim(),
    runtimeContent: formatRuntimeComposerSubmission(submission),
    historyContent: submission.text.trim(),
    images: submission.inputs.flatMap((input) => input.kind === 'image'
      ? [{ data: input.attachment.data, mimeType: input.attachment.mimeType }] : []),
    publicAttachments: publicAttachments.length ? publicAttachments : undefined,
  };
}

function toPublicAttachment(input: ResolvedComposerInput): PublicComposerAttachment | null {
  if (input.kind === 'image') return null;
  const attachment = input.attachment;
  return {
    id: attachment.id,
    kind: attachment.kind,
    name: attachment.name,
    ...(attachment.path ? { path: attachment.path } : {}),
    ...(attachment.kind === 'mention' ? { mentionType: attachment.mentionType } : {}),
  };
}

export function formatRuntimeComposerSubmission(submission: ComposerSubmission): string {
  if (!submission.inputs.some((input) => input.kind !== 'image')) return submission.text;
  return JSON.stringify({
    schema: 'svton.composer-input.v1',
    text: submission.text,
    inputs: submission.inputs.map((input) => input.kind === 'file'
      ? { kind: input.kind, name: input.attachment.name, path: input.attachment.path,
          mimeType: input.attachment.mimeType, content: input.text }
      : { kind: input.kind, name: input.attachment.name, path: 'path' in input.attachment ? input.attachment.path : undefined,
          type: input.kind === 'mention' ? input.attachment.mentionType : undefined,
          mimeType: input.kind === 'image' ? input.attachment.mimeType : undefined }),
  });
}
