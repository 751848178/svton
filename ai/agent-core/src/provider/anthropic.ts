import type {
  IProvider,
  ChatMessage,
  ChatOptions,
  StreamEvent,
  TokenUsage,
  ModelInfo,
  ToolDefinition,
  ContentBlock,
  ToolResultContent,
  ReasoningEffort,
} from './types';
import { countTokens } from '../utils/token';
import { readSSELines } from './sse-reader';
import {
  formatAnthropicImageSource,
  type AnthropicImageSource,
} from './anthropic-image-content.utils';
import { sanitizeAnthropicToolUseChain } from './anthropic-tool-chain.utils';

/**
 * Anthropic Claude Provider.
 *
 * Supports streaming, tool use, and extended thinking.
 */
export class AnthropicProvider implements IProvider {
  readonly name = 'anthropic';
  readonly models: ModelInfo[];

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly customHeaders: Record<string, string>;

  constructor(config: {
    apiKey: string;
    baseUrl?: string;
    models?: ModelInfo[];
    customHeaders?: Record<string, string>;
  }) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    this.customHeaders = config.customHeaders || {};
    this.models = config.models || [
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        contextWindow: 200000,
        supportsToolUse: true,
        supportsVision: true,
        supportsStreaming: true,
        supportsThinking: true,
      },
      {
        id: 'claude-haiku-4-20250506',
        name: 'Claude Haiku 4',
        contextWindow: 200000,
        supportsToolUse: true,
        supportsVision: true,
        supportsStreaming: true,
        supportsThinking: true,
      },
    ];
  }

  async *chat(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamEvent> {
    const url = `${this.baseUrl}/v1/messages`;
    const body = this.buildRequestBody(messages, options);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        ...this.customHeaders,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    if (options.stream !== false) {
      yield* this.parseSSEStream(response);
    } else {
      yield* this.parseJSONResponse(response);
    }
  }

  countTokens(text: string): number {
    return countTokens(text);
  }

  supportsToolUse(model: string): boolean {
    const info = this.models.find((m) => m.id === model);
    return info?.supportsToolUse ?? true;
  }

  supportsVision(model: string): boolean {
    const info = this.models.find((m) => m.id === model);
    return info?.supportsVision ?? true;
  }

  /**
   * Map reasoningEffort to thinkingBudget tokens.
   * Returns undefined when not set (no extended thinking).
   */
  private effortToBudget(effort?: ReasoningEffort): number | undefined {
    switch (effort) {
      case 'low': return 1024;
      case 'medium': return 4096;
      case 'high': return 10000;
      case 'xhigh': return 32000;
      default: return undefined;
    }
  }

  // ----------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------

  private buildRequestBody(
    messages: ChatMessage[],
    options: ChatOptions,
  ): Record<string, unknown> {
    // Separate system message from conversation messages
    let systemPrompt = options.systemPrompt || '';
    const conversationMessages: AnthropicMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        if (typeof msg.content === 'string') {
          systemPrompt += (systemPrompt ? '\n\n' : '') + msg.content;
        }
        continue;
      }
      conversationMessages.push(this.formatMessage(msg));
    }

    // Merge consecutive same-role messages (Anthropic requirement)
    const merged = this.mergeMessages(conversationMessages);

    // Validate: ensure every tool_use has a matching tool_result
    sanitizeAnthropicToolUseChain(merged);
    const sanitizedMessages = this.mergeMessages(merged);

    const body: Record<string, unknown> = {
      model: options.model,
      messages: sanitizedMessages,
      stream: options.stream !== false,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (options.maxTokens !== undefined) {
      body.max_tokens = options.maxTokens;
    } else {
      body.max_tokens = 16384;
    }

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    // Extended thinking — reasoningEffort maps to thinkingBudget if not explicitly set
    const thinkingBudget = options.thinkingBudget ?? this.effortToBudget(options.reasoningEffort);
    if (thinkingBudget && thinkingBudget > 0) {
      body.thinking = {
        type: 'enabled',
        budget_tokens: thinkingBudget,
      };
      // Anthropic requires max_tokens > thinking budget
      if (!options.maxTokens) {
        body.max_tokens = thinkingBudget + 16384;
      }
    }

    // Tools
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    return body;
  }

  private formatMessage(msg: ChatMessage): AnthropicMessage {
    const role = msg.role === 'tool' ? 'user' : msg.role;

    if (typeof msg.content === 'string') {
      return { role: role as 'user' | 'assistant', content: msg.content };
    }

    // ContentBlock[]
    const parts: AnthropicContentBlock[] = [];

    for (const block of msg.content as ContentBlock[]) {
      switch (block.type) {
        case 'text':
          parts.push({ type: 'text', text: block.text });
          break;
        case 'image':
          parts.push({
            type: 'image',
            source: formatAnthropicImageSource(block),
          });
          break;
        case 'tool_use':
          parts.push({
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input,
          });
          break;
        case 'tool_result': {
          const output = block.output;
          let toolContent: any = output;
          // Detect image-type tool results — send text placeholder to avoid
          // API errors with non-vision models. The screenshot is displayed in the UI.
          try {
            const parsed = JSON.parse(output);
            if (parsed.type === 'image' && parsed.data) {
              toolContent = 'Screenshot captured. Image is displayed in the chat UI.';
            }
          } catch { /* not JSON image, keep as text */ }
          parts.push({
            type: 'tool_result',
            tool_use_id: block.toolUseId,
            content: toolContent,
            is_error: block.isError,
          });
          break;
        }
      }
    }

    return { role: role as 'user' | 'assistant', content: parts };
  }

  /**
   * Anthropic requires alternating user/assistant messages.
   * Merge consecutive same-role messages.
   */
  private mergeMessages(messages: AnthropicMessage[]): AnthropicMessage[] {
    if (messages.length === 0) return messages;

    const result: AnthropicMessage[] = [messages[0]];

    for (let i = 1; i < messages.length; i++) {
      const last = result[result.length - 1];
      const current = messages[i];

      if (last.role === current.role) {
        // Merge content
        const lastContent = Array.isArray(last.content) ? last.content : [{ type: 'text' as const, text: last.content as string }];
        const currentContent = Array.isArray(current.content) ? current.content : [{ type: 'text' as const, text: current.content as string }];
        last.content = [...lastContent, ...currentContent];
      } else {
        result.push(current);
      }
    }

    return result;
  }

  private async *parseSSEStream(response: Response): AsyncGenerator<StreamEvent> {
    let usage: TokenUsage | null = null;
    let completionEmitted = false;
    const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();
    for await (const data of readSSELines(response)) {
      try {
        const event = JSON.parse(data);
        switch (event.type) {
          case 'message_start':
            if (event.message?.usage) {
              usage = {
                promptTokens: event.message.usage.input_tokens,
                completionTokens: 0,
                totalTokens: event.message.usage.input_tokens,
              };
            }
            break;

          case 'content_block_start':
            if (event.content_block?.type === 'tool_use') {
              const index = typeof event.index === 'number' ? event.index : toolCallBuffers.size;
              const id = event.content_block.id;
              const name = event.content_block.name;
              toolCallBuffers.set(index, { id, name, args: '' });
              yield { type: 'tool_call_start', id, name };
            }
            break;

          case 'content_block_delta': {
            const delta = event.delta;
            if (delta?.type === 'text_delta') {
              yield { type: 'text_delta', text: delta.text };
            } else if (delta?.type === 'thinking_delta') {
              yield { type: 'thinking_delta', thinking: delta.thinking };
            } else if (delta?.type === 'input_json_delta') {
              const index = event.index;
              const buffer = toolCallBuffers.get(index);
              if (buffer) {
                buffer.args += delta.partial_json;
                yield { type: 'tool_call_delta', id: buffer.id, argumentsDelta: delta.partial_json };
              }
            }
            break;
          }

          case 'content_block_stop': {
            const index = event.index;
            const buffer = toolCallBuffers.get(index);
            if (buffer) {
              yield { type: 'tool_call_end', id: buffer.id, name: buffer.name, arguments: buffer.args };
            }
            break;
          }

          case 'message_delta':
            if (event.usage && usage) {
              usage.completionTokens = event.usage.output_tokens;
              usage.totalTokens = usage.promptTokens + usage.completionTokens;
            }
            if (event.delta?.stop_reason) {
              if (usage) yield { type: 'usage', usage };
              yield { type: 'done', stopReason: event.delta.stop_reason };
              completionEmitted = true;
            }
            break;

          case 'message_stop':
            if (completionEmitted) break;
            if (usage) yield { type: 'usage', usage };
            yield { type: 'done', stopReason: 'end_turn' };
            completionEmitted = true;
            break;
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }

  private async *parseJSONResponse(response: Response): AsyncGenerator<StreamEvent> {
    const data = await response.json();

    if (data.content) {
      for (const block of data.content) {
        if (block.type === 'text') {
          yield { type: 'text_delta', text: block.text };
        } else if (block.type === 'thinking') {
          yield { type: 'thinking_delta', thinking: block.thinking };
        } else if (block.type === 'tool_use') {
          yield {
            type: 'tool_call_start',
            id: block.id,
            name: block.name,
          };
          yield {
            type: 'tool_call_end',
            id: block.id,
            name: block.name,
            arguments: JSON.stringify(block.input),
          };
        }
      }
    }

    if (data.usage) {
      const usage: TokenUsage = {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      };
      yield { type: 'usage', usage };
    }

    yield {
      type: 'done',
      stopReason: data.stop_reason || 'end_turn',
    };
  }

}

// ============================================================
// Anthropic API types (internal)
// ============================================================

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: AnthropicImageSource }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };
