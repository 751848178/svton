import type React from 'react';

export const MAX_COMPOSER_FILE_BYTES = 64 * 1024;
export const MAX_COMPOSER_FILE_CODEPOINTS = 20_000;
export const MAX_COMPOSER_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_COMPOSER_IMAGES = 8;

export type ComposerAttachment =
  | { id: string; kind: 'file'; name: string; path?: string; size: number; mimeType?: string }
  | { id: string; kind: 'image'; name: string; data: string; size: number; mimeType: string }
  | { id: string; kind: 'skill'; name: string; path: string }
  | { id: string; kind: 'mention'; name: string; path: string; mentionType: 'file' | 'folder' | 'tool' };

export interface ComposerDraft {
  text: string;
  attachments: ComposerAttachment[];
}

export type ComposerIntent =
  | { id: string; kind: 'turn.send'; draft: ComposerDraft }
  | { id: string; kind: 'turn.stop' }
  | { id: string; kind: 'slash.execute'; commandId: string; args: string }
  | { id: string; kind: 'assistantAction.execute'; actionId: string; payload?: unknown }
  | { id: string; kind: 'draft.file.pick' };

export type ComposerIntentResult =
  | { id: string; kind: 'succeeded'; message?: string; attachment?: ComposerAttachment }
  | { id: string; kind: 'unsupported'; message: string }
  | { id: string; kind: 'failed'; message: string; retryable: boolean }
  | { id: string; kind: 'busy'; message: string; retryable: true }
  | { id: string; kind: 'cancelled'; message?: string };

export type ComposerCapability =
  | { supported: true }
  | { supported: false; reason: string };

export interface ComposerInteraction {
  dispatch: (intent: ComposerIntent) => Promise<ComposerIntentResult>;
  createOperationId: () => string;
  result: ComposerIntentResult | null;
  pending: boolean;
  resolveAssistantAction: (actionId: string) => ComposerCapability;
}

export interface SlashCommand {
  /** Stable intent identity. Optional for the legacy name/action API. */
  id?: string;
  name: string;
  description: string;
  execute?: (args: string) => boolean | Promise<boolean>;
  /** @deprecated Prefer execute; retained for existing ChatInput consumers. */
  action?: () => void;
  capability?: ComposerCapability;
  allowWhileBusy?: boolean;
}

export interface MentionItem {
  /** Structured identities are optional to preserve the legacy display-only API. */
  id?: string;
  label: string;
  name?: string;
  path?: string;
  description?: string;
  icon?: React.ReactNode;
  category?: 'file' | 'folder' | 'tool' | 'skill';
}

export interface ComposerFileAdapter {
  capability: ComposerCapability;
  pick: () => Promise<
    | { kind: 'selected'; attachment: Extract<ComposerAttachment, { kind: 'file' }> }
    | { kind: 'cancelled' }
    | { kind: 'failed'; message: string }
  >;
  readText: (
    attachment: Extract<ComposerAttachment, { kind: 'file' }>,
  ) => Promise<{ kind: 'succeeded'; text: string } | { kind: 'failed'; message: string }>;
}

export type ResolvedComposerInput =
  | { kind: 'file'; attachment: Extract<ComposerAttachment, { kind: 'file' }>; text: string }
  | { kind: 'image'; attachment: Extract<ComposerAttachment, { kind: 'image' }> }
  | { kind: 'skill'; attachment: Extract<ComposerAttachment, { kind: 'skill' }> }
  | { kind: 'mention'; attachment: Extract<ComposerAttachment, { kind: 'mention' }> };

export interface ComposerSubmission {
  text: string;
  inputs: ResolvedComposerInput[];
}
