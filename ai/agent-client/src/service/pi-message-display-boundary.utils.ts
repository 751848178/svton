/**
 * Canonical Pi `AgentMessage[]` → Client `DisplayMessage[]` projection.
 *
 * The runtime/checkpoint is the canonical transcript source. When a session is
 * reloaded and the checkpoint restores the runtime, the display list must be
 * re-derived from the runtime's `AgentMessage[]` (the saved session-display list
 * may be empty/stale). This is the minimal reverse of the streaming mutators —
 * enough to rehydrate user/assistant text, thinking, and tool calls so the UI
 * shows the prior conversation after a refresh or session switch.
 */
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { AssistantMessage, Message, ToolResultMessage } from '@earendil-works/pi-ai';
import type { ContentBlock, DisplayMessage, DisplayToolCall } from '../types';

function restoredId(role: string, timestamp: number, index: number): string {
  return `restored-${role}-${timestamp}-${index}`;
}

function contentToText(content: Message['content']): string {
  if (typeof content === 'string') return content;
  return content
    .filter((b) => b.type === 'text')
    .map((block) => block.text)
    .join('');
}

function extractThinking(content: AssistantMessage['content']): string | undefined {
  const parts = content
    .filter((b) => b.type === 'thinking')
    .map((block) => block.thinking);
  return parts.length > 0 ? parts.join('\n') : undefined;
}

function extractToolCalls(content: AssistantMessage['content']): DisplayToolCall[] | undefined {
  const calls: DisplayToolCall[] = [];
  for (const b of content) {
    if (b.type === 'toolCall') {
      calls.push({
        id: b.id,
        name: b.name,
        arguments: b.arguments,
        metadata: b.thoughtSignature
          ? { thoughtSignature: b.thoughtSignature }
          : undefined,
        status: 'completed',
      });
    }
  }
  return calls.length > 0 ? calls : undefined;
}

export function piMessagesToDisplay(messages: AgentMessage[]): DisplayMessage[] {
  const out: DisplayMessage[] = [];
  const toolResults = new Map<string, ToolResultMessage>();
  // First pass: collect tool results keyed by tool_use id (when present).
  for (const m of messages) {
    if (m.role === 'toolResult') toolResults.set(m.toolCallId, m);
  }

  for (const [index, m] of messages.entries()) {
    if (m.role === 'user') {
      out.push({
        id: restoredId('user', m.timestamp, index),
        role: 'user',
        content: contentToText(m.content),
        images: typeof m.content === 'string'
          ? undefined
          : m.content
            .filter((block) => block.type === 'image')
            .map((block) => ({ data: block.data, mimeType: block.mimeType })),
        timestamp: m.timestamp,
      });
    } else if (m.role === 'assistant') {
      const toolCalls = extractToolCalls(m.content);
      // Attach tool results to their calls when available.
      if (toolCalls) {
        for (const tc of toolCalls) {
          const result = toolResults.get(tc.id);
          if (result) tc.result = toDisplayToolResult(result);
        }
      }
      out.push({
        id: restoredId('assistant', m.timestamp, index),
        role: 'assistant',
        content: contentToText(m.content),
        thinking: extractThinking(m.content),
        error: m.errorMessage,
        toolCalls,
        blocks: toDisplayBlocks(m.content, toolCalls),
        metadata: assistantMetadata(m),
        timestamp: m.timestamp,
      });
    }
  }
  return out;
}

function toDisplayBlocks(
  content: AssistantMessage['content'],
  calls: DisplayToolCall[] | undefined,
): ContentBlock[] {
  const callsById = new Map((calls ?? []).map((call) => [call.id, call]));
  const blocks: ContentBlock[] = [];
  for (const block of content) {
    if (block.type === 'text') {
      blocks.push({
        type: 'text',
        text: block.text,
        textSignature: block.textSignature,
      });
    }
    if (block.type === 'thinking') {
      blocks.push(block.redacted
        ? {
          type: 'redacted_thinking',
          thinkingSignature: block.thinkingSignature,
        }
        : {
          type: 'thinking',
          text: block.thinking,
          thinkingSignature: block.thinkingSignature,
        });
    }
    if (block.type === 'toolCall') {
      const call = callsById.get(block.id);
      if (call) blocks.push({ type: 'tool_call', call });
    }
  }
  return blocks;
}

function toDisplayToolResult(message: ToolResultMessage) {
  const output = message.content
    .map((block) => block.type === 'text'
      ? block.text
      : JSON.stringify({ type: 'image', data: block.data, mimeType: block.mimeType }))
    .join('\n');
  return {
    callId: message.toolCallId,
    output,
    isError: message.isError,
    metadata: {
      toolName: message.toolName,
      details: message.details,
      usage: message.usage,
      addedToolNames: message.addedToolNames,
      timestamp: message.timestamp,
    },
  };
}

function assistantMetadata(message: AssistantMessage): Record<string, unknown> {
  return {
    api: message.api,
    provider: message.provider,
    model: message.model,
    responseModel: message.responseModel,
    responseId: message.responseId,
    usage: message.usage,
    stopReason: message.stopReason,
    errorMessage: message.errorMessage,
  };
}
