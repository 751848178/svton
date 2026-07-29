import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type {
  AssistantMessage,
  Message,
  TextContent,
  ToolCall,
} from '@earendil-works/pi-ai';

function isPiMessage(message: AgentMessage): message is Message {
  return 'role' in message
    && (message.role === 'user'
      || message.role === 'assistant'
      || message.role === 'toolResult');
}

/** Read text from one canonical Pi transcript message. */
export function piMessageText(message: AgentMessage): string {
  if (!isPiMessage(message)) return '';
  const content = message.content;
  if (typeof content === 'string') return content;
  return content
    .filter((block): block is TextContent => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

/** Read tool calls directly from Pi assistant content. */
export function piToolCalls(message: AgentMessage): ToolCall[] {
  if (!isPiMessage(message) || message.role !== 'assistant') return [];
  return message.content.filter((block): block is ToolCall => block.type === 'toolCall');
}

/** Read text returned by one canonical Pi tool-result message. */
export function piToolResultTexts(message: AgentMessage): string[] {
  if (!isPiMessage(message) || message.role !== 'toolResult') return [];
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text);
}

/** Whether an assistant message contains canonical Pi thinking content. */
export function piMessageHasThinking(message: AgentMessage): boolean {
  return isPiMessage(message)
    && message.role === 'assistant'
    && message.content.some((block) => block.type === 'thinking');
}

/** Select the last assistant message from canonical Pi state. */
export function lastPiAssistant(
  messages: AgentMessage[],
): AssistantMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message && isPiMessage(message) && message.role === 'assistant') {
      return message;
    }
  }
  return undefined;
}
