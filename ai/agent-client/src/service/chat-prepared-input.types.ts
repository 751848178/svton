export interface ChatPreparedInput {
  publicContent: string;
  runtimeContent: string;
  historyContent: string;
  images?: Array<{ data: string; mimeType?: string }>;
  publicAttachments?: PublicComposerAttachment[];
}

export interface PublicComposerAttachment {
  id: string;
  kind: 'file' | 'skill' | 'mention';
  name: string;
  path?: string;
  mentionType?: 'file' | 'folder' | 'tool';
}
