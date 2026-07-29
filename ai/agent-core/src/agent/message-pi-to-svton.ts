/**
 * Pi → svton message conversion (the reverse direction of `message-bridge.ts`).
 *
 * Extracted to keep each conversion direction under the 200-line ceiling
 * (code-structure-standards). Pi `AgentMessage`/`Message` → svton `ChatMessage`.
 */
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type {
  AssistantMessage,
  Message,
  TextContent,
  ToolCall as PiToolCall,
  ToolResultMessage,
  UserMessage,
} from '@earendil-works/pi-ai';
import type {
  ChatMessage,
  ContentBlock,
  ReasoningContent,
  TextContent as SvtonTextContent,
  ToolResultContent,
  ToolUseContent,
} from '../provider/types';

/** Convert pi-ai `AgentMessage[]` back into svton `ChatMessage[]`. */
export function toChatMessages(messages: AgentMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const msg of messages) {
    const converted = toChatMessage(msg as Message);
    if (converted) out.push(converted);
  }
  return out;
}

function toChatMessage(msg: Message): ChatMessage | null {
  switch (msg.role) {
    case 'user':
      return fromUserMessage(msg);
    case 'assistant':
      return fromAssistantMessage(msg);
    case 'toolResult':
      return fromToolResultMessage(msg);
    default:
      return null;
  }
}

function fromUserMessage(msg: UserMessage): ChatMessage {
  if (typeof msg.content === 'string') {
    return { role: 'user', content: msg.content };
  }
  const blocks: ContentBlock[] = [];
  for (const b of msg.content) {
    if (b.type === 'text') {
      blocks.push({ type: 'text', text: b.text });
    } else if (b.type === 'image') {
      blocks.push({ type: 'image', data: b.data, mimeType: b.mimeType });
    }
  }
  return { role: 'user', content: blocks };
}

function fromAssistantMessage(msg: AssistantMessage): ChatMessage {
  const blocks: ContentBlock[] = [];
  for (const b of msg.content) {
    if (b.type === 'text') {
      const tb: SvtonTextContent = { type: 'text', text: b.text };
      blocks.push(tb);
    } else if (b.type === 'thinking') {
      const rb: ReasoningContent = { type: 'reasoning', text: b.thinking };
      blocks.push(rb);
    } else if (b.type === 'toolCall') {
      blocks.push(toolUseBlock(b));
    }
  }
  if (blocks.length === 1 && blocks[0].type === 'text') {
    return { role: 'assistant', content: (blocks[0] as SvtonTextContent).text };
  }
  if (blocks.length === 0) {
    return { role: 'assistant', content: '' };
  }
  return { role: 'assistant', content: blocks };
}

function toolUseBlock(tc: PiToolCall): ToolUseContent {
  return { type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments ?? {} };
}

function fromToolResultMessage(msg: ToolResultMessage): ChatMessage {
  // Pi emits one ToolResultMessage per tool call; svton packs a single
  // tool_result block into a `tool`-role message.
  const output = msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
  const block: ToolResultContent = {
    type: 'tool_result',
    toolUseId: msg.toolCallId,
    output,
    isError: msg.isError === true,
  };
  return { role: 'tool', content: [block] };
}

export type { TextContent };
