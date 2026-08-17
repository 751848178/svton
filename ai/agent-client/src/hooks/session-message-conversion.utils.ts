import type { ContentBlock, DisplayMessage, DisplayToolCall } from '../types';
import { backfillAutoReviewBlocks } from './session-auto-review-block.utils';
import { migrateLegacyMessageTimeline } from '../timeline/legacy-compatibility';
import { deserializeTimeline, serializeTimeline } from '../timeline/serialization';
import { deserializePublicAttachments, serializePublicAttachments } from '../service/chat-public-attachments';
export { deriveTitle } from '../service/session-title-policy';

interface StoredToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status: string;
  result?: StoredToolResult;
}

interface StoredToolResult {
  callId: string;
  output: string;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}

export function displayToStoredMessages(msgs: DisplayMessage[]): unknown[] {
  return msgs
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role,
      id: m.id,
      content: m.content,
      error: m.error || undefined,
      thinking: m.thinking || undefined,
      images: m.images || undefined,
      publicAttachments: serializePublicAttachments(m.publicAttachments),
      duration: m.duration || undefined,
      activeSkills: m.activeSkills?.length ? m.activeSkills : undefined,
      toolCalls: m.toolCalls?.length ? m.toolCalls.map(toStoredToolCall) : undefined,
      blocks: readPersistableBlocks(m.blocks),
      timeline: serializeTimeline(m.timeline),
      runtimeMessageIndex: m.runtimeMessageIndex,
      runId: m.runId,
      timestamp: m.timestamp,
    }));
}

export function storedToDisplayMessages(msgs: unknown[]): DisplayMessage[] {
  let c = 0;
  const out: DisplayMessage[] = [];
  for (const raw of msgs) {
    const m = raw as Record<string, unknown>;
    if (!m.role) continue;

    const content = (m.content as string) ?? '';
    const tc = m.toolCalls as StoredToolCall[] | undefined;
    const restoredTc = tc?.map(toDisplayToolCall) || [];
    const blocks = restoreBlocks(m, restoredTc);
    const restored: DisplayMessage = {
      id: typeof m.id === 'string' ? m.id : `restored_${++c}_${Date.now()}`,
      role: m.role as 'user' | 'assistant',
      content,
      error: m.error as string | undefined,
      thinking: m.thinking as string | undefined,
      images: m.images as Array<{ data: string; mimeType?: string }> | undefined,
      publicAttachments: deserializePublicAttachments(m.publicAttachments),
      toolCalls: restoredTc,
      blocks,
      duration: m.duration as number | undefined,
      activeSkills: Array.isArray(m.activeSkills) ? (m.activeSkills as string[]) : undefined,
      timeline: deserializeTimeline(m.timeline),
      runtimeMessageIndex: Number.isInteger(m.runtimeMessageIndex)
        ? m.runtimeMessageIndex as number
        : undefined,
      runId: typeof m.runId === 'string' ? m.runId : undefined,
      timestamp: typeof m.timestamp === 'number' ? m.timestamp : Date.now(),
    };
    restored.timeline ??= migrateLegacyMessageTimeline(restored);
    out.push(restored);
  }
  return out;
}

function toStoredToolCall(tc: DisplayToolCall): StoredToolCall {
  return {
    id: tc.id,
    name: tc.name,
    arguments: tc.arguments,
    ...(tc.metadata ? { metadata: tc.metadata } : {}),
    status: tc.status,
    result: toStoredToolResult(tc.result),
  };
}

function toStoredBlock(block: ContentBlock): ContentBlock | { type: 'tool_call'; call: StoredToolCall } {
  if (block.type !== 'tool_call' || !block.call) return block;
  return { type: block.type, call: toStoredToolCall(block.call) };
}

function restoreBlocks(
  message: Record<string, unknown>,
  restoredTc: DisplayToolCall[],
): ContentBlock[] | undefined {
  const rawBlocks = message.blocks as Array<Record<string, unknown>> | undefined;
  if (rawBlocks && rawBlocks.length > 0) {
    const blocks = rawBlocks
      .map(toDisplayBlock)
      .filter((block) => block.type !== 'code_review')
      .filter((block) => block.type !== 'tool_call' || block.call);
    return backfillAutoReviewBlocks(blocks);
  }
  if (!message.thinking && restoredTc.length === 0) return undefined;

  const blocks: ContentBlock[] = [];
  if (message.thinking) blocks.push({ type: 'thinking', text: message.thinking as string });
  for (const t of restoredTc) {
    blocks.push({ type: 'tool_call', call: t });
  }
  return backfillAutoReviewBlocks(blocks);
}

function readPersistableBlocks(
  blocks: ContentBlock[] | undefined,
): Array<ContentBlock | { type: 'tool_call'; call: StoredToolCall }> | undefined {
  const persistable = blocks
    ?.filter((block) => block.type !== 'code_review')
    .map(toStoredBlock);
  return persistable?.length ? persistable : undefined;
}

function toDisplayBlock(block: Record<string, unknown>): ContentBlock {
  if (block.type !== 'tool_call') return block as ContentBlock;
  const call = block.call as StoredToolCall | undefined;
  return {
    type: 'tool_call',
    call: call ? toDisplayToolCall(call) : undefined as any,
  };
}

function toDisplayToolCall(call: StoredToolCall): DisplayToolCall {
  return {
    id: call.id,
    name: call.name,
    arguments: call.arguments,
    ...(call.metadata ? { metadata: call.metadata } : {}),
    status: call.status as DisplayToolCall['status'],
    result: toDisplayToolResult(call.result),
  };
}

function toStoredToolResult(result: DisplayToolCall['result']): StoredToolResult | undefined {
  if (!result) return undefined;
  const metadata = readSerializableToolResultMetadata(result.metadata);
  return {
    callId: result.callId,
    output: result.output,
    isError: result.isError,
    ...(metadata ? { metadata } : {}),
  };
}

function toDisplayToolResult(result: StoredToolResult | undefined): DisplayToolCall['result'] {
  if (!result) return undefined;
  return {
    callId: result.callId,
    output: result.output,
    isError: result.isError,
    ...(result.metadata ? { metadata: result.metadata } : {}),
  };
}

function readSerializableToolResultMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!metadata?.autoReviewVerdict) return undefined;
  return { autoReviewVerdict: metadata.autoReviewVerdict };
}
