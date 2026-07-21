import type { ChatMessage, ContentBlock } from '../provider/types';

function cloneUnknownValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneUnknownValue);
  if (!value || typeof value !== 'object') return value;

  const clone: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    clone[key] = cloneUnknownValue(entry);
  }
  return clone;
}

function cloneContentBlock(block: ContentBlock): ContentBlock {
  if (block.type === 'tool_use') {
    return { ...block, input: cloneUnknownValue(block.input) as Record<string, unknown> };
  }
  return { ...block };
}

export function cloneChatMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    content: typeof message.content === 'string'
      ? message.content
      : message.content.map(cloneContentBlock),
  };
}

export function cloneChatMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(cloneChatMessage);
}
