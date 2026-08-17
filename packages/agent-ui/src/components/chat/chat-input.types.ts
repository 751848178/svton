import type React from 'react';
import type {
  ComposerAttachment,
  ComposerInteraction,
  MentionItem,
  SlashCommand,
} from './composer.types';

export interface ChatInputProps {
  interaction?: ComposerInteraction;
  onSend?: (content: string, images?: Array<{ data: string; mimeType: string }>) => void | Promise<void>;
  onAbort?: () => void | Promise<void>;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  leadingSlot?: React.ReactNode;
  trailingSlot?: React.ReactNode;
  slashCommands?: SlashCommand[];
  mentionItems?: MentionItem[];
  onMentionSelect?: (item: MentionItem) => string;
  onFileReference?: () => void | Promise<void>;
  inputHistory?: string[];
  className?: string;
}

export type ImageAttachment = Extract<ComposerAttachment, { kind: 'image' }>;
