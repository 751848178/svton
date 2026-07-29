/**
 * ChatMessage → DisplayMessage conversion.
 *
 * The runtime/checkpoint is the canonical transcript source. When a session is
 * reloaded and the checkpoint restores the runtime, the display list must be
 * re-derived from the runtime's `ChatMessage[]` (the saved session-display list
 * may be empty/stale). This is the minimal reverse of the streaming mutators —
 * enough to rehydrate user/assistant text, thinking, and tool calls so the UI
 * shows the prior conversation after a refresh or session switch.
 */
import type { ChatMessage, ContentBlock, ToolUseContent, ToolResultContent } from '@svton/agent-core';
import type { DisplayMessage, DisplayToolCall } from '../types';

let seq = 0;
function nextId(role: string): string {
  seq += 1;
  return `restored-${role}-${Date.now()}-${seq}`;
}

function contentToText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('');
}

function extractThinking(content: ContentBlock[]): string | undefined {
  const parts = content
    .filter((b) => b.type === 'reasoning')
    .map((b) => (b as { text: string }).text);
  return parts.length > 0 ? parts.join('\n') : undefined;
}

function extractToolCalls(content: ContentBlock[]): DisplayToolCall[] | undefined {
  const calls: DisplayToolCall[] = [];
  for (const b of content) {
    if (b.type === 'tool_use') {
      const use = b as ToolUseContent;
      calls.push({
        id: use.id,
        name: use.name,
        arguments: use.input ?? {},
        status: 'completed',
      });
    }
  }
  return calls.length > 0 ? calls : undefined;
}

/** Convert svton `ChatMessage[]` (runtime/checkpoint truth) to display messages. */
export function chatToDisplayMessages(messages: ChatMessage[]): DisplayMessage[] {
  const out: DisplayMessage[] = [];
  const toolResults = new Map<string, ToolResultContent>();
  // First pass: collect tool results keyed by tool_use id (when present).
  for (const m of messages) {
    if (m.role !== 'tool') continue;
    const blocks = Array.isArray(m.content) ? (m.content as ContentBlock[]) : [];
    for (const b of blocks) {
      if (b.type === 'tool_result') {
        const tr = b as ToolResultContent;
        if (tr.tool_use_id) toolResults.set(tr.tool_use_id, tr);
      }
    }
  }

  for (const m of messages) {
    if (m.role === 'user') {
      out.push({
        id: nextId('user'),
        role: 'user',
        content: contentToText(m.content),
        timestamp: Date.now(),
      });
    } else if (m.role === 'assistant') {
      const blocks = Array.isArray(m.content) ? (m.content as ContentBlock[]) : [];
      const toolCalls = extractToolCalls(blocks);
      // Attach tool results to their calls when available.
      if (toolCalls) {
        for (const tc of toolCalls) {
          const res = toolResults.get(tc.id);
          if (res) tc.result = { output: typeof res.content === 'string' ? res.content : '', isError: !!res.is_error };
        }
      }
      out.push({
        id: nextId('assistant'),
        role: 'assistant',
        content: contentToText(m.content),
        thinking: extractThinking(blocks),
        toolCalls,
        blocks,
        timestamp: Date.now(),
      });
    }
  }
  return out;
}
