/**
 * Message bridge: converts svton `ChatMessage` → pi-ai `AgentMessage`.
 *
 * Pi Agent owns the in-memory transcript (`AgentMessage[]`); svton consumers
 * (checkpoint/manager, subagent seeding, SDK, chat.service model-switch) read
 * and write svton-format `ChatMessage[]`. This module + `message-pi-to-svton.ts`
 * are the only boundaries where the two shapes meet (Architecture §5.4).
 *
 * Direction split (code-structure-standards, 200-line ceiling):
 * - this file: svton `ChatMessage[]` → pi-ai `AgentMessage[]`
 * - `message-pi-to-svton.ts`: pi-ai → svton (re-exported here for callers).
 *
 * Conversion rules:
 * - svton `system` role → pi-ai `user` message wrapping the system text (pi-ai
 *   carries the system prompt out-of-band; svton stores system messages inline,
 *   so we round-trip them as user text to keep them visible to the model).
 * - svton `tool` role (carrying `tool_result` blocks) → pi-ai `toolResult`
 *   messages (one per result block).
 * - svton `assistant` with `tool_use`/`reasoning`/`text` blocks → pi-ai
 *   `assistant` message with `toolCall`/`thinking`/`text` content.
 */
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type {
  AssistantMessage,
  Message,
  TextContent,
  ToolResultMessage,
  UserMessage,
  ImageContent as PiImageContent,
} from '@earendil-works/pi-ai';
import type {
  ChatMessage,
  ContentBlock,
} from '../provider/types';

const NOW = () => Date.now();

/** Convert svton `ChatMessage[]` into pi-ai `AgentMessage[]` for Pi Agent. */
export function toAgentMessages(messages: ChatMessage[]): AgentMessage[] {
  const out: AgentMessage[] = [];
  for (const msg of messages) {
    out.push(...toAgentMessage(msg));
  }
  return out;
}

function toAgentMessage(msg: ChatMessage): AgentMessage[] {
  if (typeof msg.content === 'string') {
    if (msg.role === 'system') return [userTextMessage(msg.content)];
    if (msg.role === 'assistant') return [assistantMessage([{ type: 'text', text: msg.content }])];
    return [userTextMessage(msg.content)];
  }
  const blocks = msg.content;
  if (msg.role === 'assistant') return [assistantMessage(toAssistantBlocks(blocks))];
  if (msg.role === 'tool') return toToolResultMessages(blocks);
  return [userMessage(toUserBlocks(blocks))];
}

function toAssistantBlocks(blocks: ContentBlock[]): AssistantMessage['content'] {
  const out: AssistantMessage['content'] = [];
  for (const b of blocks) {
    if (b.type === 'text') {
      out.push({ type: 'text', text: b.text });
    } else if (b.type === 'reasoning') {
      out.push({ type: 'thinking', thinking: b.text });
    } else if (b.type === 'tool_use') {
      out.push({ type: 'toolCall', id: b.id, name: b.name, arguments: b.input ?? {} });
    }
  }
  return out;
}

function toUserBlocks(blocks: ContentBlock[]): UserMessage['content'] {
  const out: (TextContent | PiImageContent)[] = [];
  for (const b of blocks) {
    if (b.type === 'text') {
      out.push({ type: 'text', text: b.text });
    } else if (b.type === 'image') {
      out.push({ type: 'image', data: b.data, mimeType: b.mimeType ?? 'image/png' });
    }
  }
  return out;
}

function toToolResultMessages(blocks: ContentBlock[]): ToolResultMessage[] {
  const out: ToolResultMessage[] = [];
  for (const b of blocks) {
    if (b.type !== 'tool_result') continue;
    out.push({
      role: 'toolResult',
      toolCallId: b.toolUseId,
      toolName: '',
      content: [{ type: 'text', text: b.output }],
      isError: b.isError === true,
      timestamp: NOW(),
    });
  }
  return out;
}

function userTextMessage(text: string): UserMessage {
  return { role: 'user', content: text, timestamp: NOW() };
}

function userMessage(content: UserMessage['content']): UserMessage {
  return { role: 'user', content, timestamp: NOW() };
}

/** Build a minimal assistant message (used for restored/seeded history). */
function assistantMessage(content: AssistantMessage['content']): AssistantMessage {
  return {
    role: 'assistant',
    content,
    api: 'openai-responses' as never,
    provider: 'openai' as never,
    model: '',
    usage: emptyUsage(),
    stopReason: 'stop',
    timestamp: NOW(),
  };
}

/** Empty usage object for synthesized assistant messages. */
export function emptyUsage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

// Reverse direction (pi-ai → svton) lives in message-pi-to-svton.ts.
export { toChatMessages } from './message-pi-to-svton';
export type { AgentMessage, Message };
