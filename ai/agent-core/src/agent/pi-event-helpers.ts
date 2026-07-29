/**
 * Pure extraction helpers for `pi-event-adapter.ts`, kept here so the adapter
 * stays under the 200-line ceiling. Both helpers are side-effect free.
 */
import type { AssistantMessage, AssistantMessageEvent } from '@earendil-works/pi-ai';
import type { ToolCall } from '../tool/types';
import { normalizeProviderToolName } from './provider-tool-call.utils';

/**
 * Extract a svton ToolCall from a toolcall_* AssistantMessageEvent by indexing
 * into the partial message content.
 */
export function readToolCallFromEvent(
  ev: Extract<AssistantMessageEvent, { contentIndex: number }>,
): ToolCall | null {
  const partial = (ev as { partial?: AssistantMessage }).partial;
  if (!partial || !Array.isArray(partial.content)) return null;
  const block = partial.content[ev.contentIndex];
  if (!block || block.type !== 'toolCall') return null;
  const name = normalizeProviderToolName(block.name);
  if (!name) return null;
  return {
    id: block.id,
    name,
    arguments: block.arguments ?? {},
  };
}

/**
 * Extract a text message from a Pi tool-execution `partialResult`. The
 * pi-tool-adapter forwards svton `onProgress(message)` as a
 * `{content:[{type:'text',text}]}` partial; join any text blocks present.
 */
export function extractPartialText(partialResult: unknown): string {
  if (!partialResult || typeof partialResult !== 'object') return '';
  const content = (partialResult as { content?: unknown }).content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b): b is { type: 'text'; text: string } =>
      Boolean(b) && typeof b === 'object' && (b as { type?: string }).type === 'text')
    .map((b) => b.text)
    .join('');
}
