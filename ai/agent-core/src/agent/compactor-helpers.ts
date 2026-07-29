/**
 * Pure helpers for `SvtonCompactor`: token estimation, summary formatting, and
 * summary-message construction.
 *
 * Extracted from `svton-compactor.ts` to keep the compaction policy class
 * under the 200-line ceiling (code-structure-standards). All functions here
 * are stateless.
 */
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { AssistantMessage, Message, TextContent } from '@earendil-works/pi-ai';
import { countTokens } from '../utils/token';

/** Build the injected "[Conversation Summary]" user message. */
export function summaryUserMessage(summary: string): AgentMessage {
  const text =
    '[Conversation Summary]\nThe following is a summary of earlier conversation that was compacted to save context space:\n\n' +
    summary;
  return { role: 'user', content: text, timestamp: Date.now() } as AgentMessage;
}

/** Render one message to a compact string for the summarizer prompt. */
export function formatForSummary(msg: AgentMessage): string {
  const m = msg as Message;
  const content = typeof m.content === 'string' ? m.content : serializeBlocks(m.content);
  const role = m.role === 'toolResult' ? 'tool' : m.role;
  return `${role}: ${content.slice(0, 500)}`;
}

/** Serialize an assistant/user content-block array to flat text. */
export function serializeBlocks(content: Message['content']): string {
  if (typeof content === 'string') return content;
  return (content as AssistantMessage['content'])
    .map((b) => {
      const block = b as TextContent;
      if (block.type === 'text') return block.text;
      if ((b as { type: string }).type === 'toolCall') {
        const tc = b as { type: string; name: string; arguments: unknown };
        return JSON.stringify({ tool: tc.name, args: tc.arguments });
      }
      if ((b as { type: string }).type === 'thinking') {
        return (b as { type: string; thinking: string }).thinking;
      }
      return '';
    })
    .join(' ');
}

/** Rough token estimate for a transcript (mirrors legacy ContextManager). */
export function estimateTokens(messages: AgentMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    const m = msg as Message;
    if (typeof m.content === 'string') {
      total += countTokens(m.content);
      continue;
    }
    for (const b of m.content as AssistantMessage['content']) {
      const block = b as TextContent & { thinking?: string; arguments?: unknown };
      if (block.type === 'text') {
        total += countTokens(block.text);
      } else if ((b as { type: string }).type === 'thinking') {
        total += countTokens(block.thinking ?? '');
      } else if ((b as { type: string }).type === 'toolCall') {
        total += countTokens(JSON.stringify((b as { arguments: unknown }).arguments ?? {}));
      } else {
        total += 20;
      }
    }
  }
  return total;
}
