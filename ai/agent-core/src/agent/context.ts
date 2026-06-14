import type { ChatMessage, StreamEvent } from '../provider/types';
import type { IProvider } from '../provider/types';
import { countTokens } from '../utils/token';

const DEFAULT_MAX_TOKENS = 128000;
const DEFAULT_THRESHOLD = 0.8;
const DEFAULT_RESERVED = 4096;
const DEFAULT_PRESERVE_RECENT = 6;

/**
 * Manages the conversation context / message history.
 * Handles compaction when the context grows too large.
 */
export class ContextManager {
  private messages: ChatMessage[] = [];
  private estimatedTokens = 0;
  private readonly maxTokens: number;
  private readonly threshold: number;
  private readonly reserved: number;
  private readonly preserveRecent: number;
  private provider: IProvider | null = null;
  private model: string | null = null;

  constructor(config?: {
    maxTokens?: number;
    compactionThreshold?: number;
    reservedForResponse?: number;
    preserveRecentMessages?: number;
  }) {
    this.maxTokens = config?.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.threshold = config?.compactionThreshold ?? DEFAULT_THRESHOLD;
    this.reserved = config?.reservedForResponse ?? DEFAULT_RESERVED;
    this.preserveRecent = config?.preserveRecentMessages ?? DEFAULT_PRESERVE_RECENT;
  }

  /**
   * Set the provider and model for LLM-based summarization.
   * If set, compaction will use the LLM to summarize removed messages.
   * If not set, falls back to simple truncation.
   */
  setProvider(provider: IProvider, model: string): void {
    this.provider = provider;
    this.model = model;
  }

  addMessage(message: ChatMessage): void {
    this.messages.push(message);
    this.estimatedTokens += this.estimateTokens(message);
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  setMessages(messages: ChatMessage[]): void {
    this.messages = messages;
    this.estimatedTokens = messages.reduce(
      (sum, msg) => sum + this.estimateTokens(msg),
      0,
    );
  }

  getTokenCount(): number {
    return this.estimatedTokens;
  }

  needsCompaction(): boolean {
    return this.estimatedTokens >= this.maxTokens * this.threshold - this.reserved;
  }

  getAvailableTokens(): number {
    return this.maxTokens - this.estimatedTokens - this.reserved;
  }

  /**
   * Compact the context by summarizing older messages.
   * If a provider is configured, uses the LLM to generate a summary.
   * Otherwise falls back to simple truncation.
   */
  async compact(): Promise<{ removed: ChatMessage[]; kept: ChatMessage[]; summary?: string }> {
    // Always keep the first system message if present
    const systemMessages = this.messages.filter((m) => m.role === 'system');
    const nonSystemMessages = this.messages.filter((m) => m.role !== 'system');

    // Keep the most recent N messages
    const recentMessages = nonSystemMessages.slice(-this.preserveRecent);
    const removedMessages = nonSystemMessages.slice(0, -this.preserveRecent);

    if (removedMessages.length === 0) {
      return { removed: [], kept: [...this.messages] };
    }

    let summaryText: string | undefined;

    // Try LLM-based summarization if provider is available
    if (this.provider && this.model) {
      summaryText = await this.summarizeWithLLM(removedMessages);
    }

    // Build the new message list
    const kept: ChatMessage[] = [];
    kept.push(...systemMessages);

    // Inject summary as a system message if available
    if (summaryText) {
      kept.push({
        role: 'system',
        content: `[Conversation Summary]\nThe following is a summary of earlier conversation that was compacted to save context space:\n\n${summaryText}`,
      });
    }

    kept.push(...recentMessages);

    this.messages = kept;
    this.estimatedTokens = kept.reduce(
      (sum, msg) => sum + this.estimateTokens(msg),
      0,
    );

    return { removed: removedMessages, kept, summary: summaryText };
  }

  clear(): void {
    this.messages = [];
    this.estimatedTokens = 0;
  }

  /**
   * Use the LLM to summarize a list of removed messages.
   */
  private async summarizeWithLLM(messages: ChatMessage[]): Promise<string | undefined> {
    if (!this.provider || !this.model) return undefined;

    try {
      // Format the conversation for the summarizer
      const formatted = messages.map((m) => {
        const content = typeof m.content === 'string'
          ? m.content
          : JSON.stringify(m.content);
        return `${m.role}: ${content.slice(0, 500)}`;
      }).join('\n\n');

      const summarizerMessages: ChatMessage[] = [
        {
          role: 'system',
          content: 'Summarize the following conversation excerpt concisely. Preserve: key facts, decisions, user preferences, important results, and any unresolved issues. Use bullet points. Keep under 500 words.',
        },
        {
          role: 'user',
          content: formatted,
        },
      ];

      // Collect the response from a non-streaming call
      let summary = '';
      for await (const event of this.provider.chat(summarizerMessages, {
        model: this.model,
        maxTokens: 1000,
        stream: true,
      })) {
        if (event.type === 'text_delta') {
          summary += event.text;
        }
      }

      return summary.trim() || undefined;
    } catch {
      // Fall back to no summary on error
      return undefined;
    }
  }

  private estimateTokens(message: ChatMessage): number {
    if (typeof message.content === 'string') {
      return this.estimateTokensForText(message.content);
    }
    if (Array.isArray(message.content)) {
      return message.content.reduce((sum, block) => {
        if (block.type === 'text') return sum + this.estimateTokensForText(block.text);
        if (block.type === 'tool_result') {
          const output = block.output;
          // Image payloads are sent as short text to the API, not the full base64.
          // Count them as a small fixed cost to avoid false compaction triggers.
          if (output && output.includes('"type":"image"')) return sum + 20;
          return sum + this.estimateTokensForText(output);
        }
        if (block.type === 'tool_use') {
          return sum + this.estimateTokensForText(JSON.stringify(block.input));
        }
        return sum + 50; // rough estimate for other blocks
      }, 0);
    }
    return 0;
  }

  private estimateTokensForText(text: string): number {
    return countTokens(text);
  }
}
