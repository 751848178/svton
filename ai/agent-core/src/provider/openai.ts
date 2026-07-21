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
import { formatOpenAIImageUrl } from './openai-image-content.utils';
import {
  collectOpenAIStreamToolCallEvents,
  flushOpenAIStreamToolCallBuffers,
  type OpenAIStreamToolCallBuffer,
} from './openai-stream-tool-call.utils';
import { sanitizeOpenAIToolUseChain } from './openai-tool-chain.utils';

/**
 * OpenAI-compatible Provider.
 *
 * Works with: OpenAI, Azure OpenAI, Ollama, vLLM, DeepSeek, etc.
 * Any service that implements the OpenAI chat completions API format.
 */
export class OpenAIProvider implements IProvider {
  readonly name: string;
  readonly models: ModelInfo[];

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly customHeaders: Record<string, string>;

  constructor(config: {
    name?: string;
    baseUrl: string;
    apiKey: string;
    models: ModelInfo[];
    customHeaders?: Record<string, string>;
  }) {
    this.name = config.name || 'openai';
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.models = config.models;
    this.customHeaders = config.customHeaders || {};
  }

  async *chat(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamEvent> {
    const url = `${this.baseUrl}/v1/chat/completions`;

    const body = this.buildRequestBody(messages, options);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...this.customHeaders,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI API error (${response.status}): ${errorText}`,
      );
    }

    const contentType = response.headers.get('content-type') || '';

    if (options.stream !== false && contentType.includes('text/event-stream')) {
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
    return info?.supportsVision ?? false;
  }

  /**
   * Map reasoningEffort to OpenAI's reasoning_effort field.
   * OpenAI supports 'low' | 'medium' | 'high'. 'xhigh' is capped to 'high'.
   */
  private mapEffort(effort: ReasoningEffort): string {
    if (effort === 'xhigh') return 'high';
    return effort;
  }

  // ----------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------

  private buildRequestBody(
    messages: ChatMessage[],
    options: ChatOptions,
  ): Record<string, unknown> {
    const formattedMessages: OpenAIChatMessage[] = [];

    if (options.systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    for (const msg of messages) {
      formattedMessages.push(this.formatMessage(msg));
    }

    // Validate: strip orphaned tool_use without matching tool_result
    sanitizeOpenAIToolUseChain(formattedMessages);

    const body: Record<string, unknown> = {
      model: options.model,
      messages: formattedMessages,
      stream: options.stream !== false,
    };

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
      body.max_tokens = options.maxTokens;
    }
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map(this.formatTool);
      body.tool_choice = 'auto';
    }

    // Reasoning effort for o-series models
    if (options.reasoningEffort) {
      body.reasoning_effort = this.mapEffort(options.reasoningEffort);
    }

    return body;
  }

  private formatMessage(msg: ChatMessage): OpenAIChatMessage {
    if (typeof msg.content === 'string') {
      return { role: msg.role, content: msg.content };
    }

    // ContentBlock[] - map to OpenAI format
    const content: OpenAIContentPart[] = [];
    const toolCalls: OpenAIToolCall[] = [];
    let toolCallId: string | undefined;
    let reasoningText: string | undefined;

    for (const block of msg.content as ContentBlock[]) {
      switch (block.type) {
        case 'text':
          content.push({ type: 'text', text: block.text });
          break;
        case 'image':
          content.push({
            type: 'image_url',
            image_url: {
              url: formatOpenAIImageUrl(block),
            },
          });
          break;
        case 'tool_use':
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments:
                typeof block.input === 'string'
                  ? block.input
                  : JSON.stringify(block.input),
            },
          });
          break;
        case 'tool_result':
          toolCallId = block.toolUseId;
          break;
        case 'reasoning':
          reasoningText = block.text;
          break;
      }
    }

    const result: OpenAIChatMessage = { role: msg.role, content: '' };

    if (reasoningText) {
      result.reasoning_content = reasoningText;
    }

    if (msg.role === 'tool' && toolCallId) {
      result.role = 'tool';
      result.tool_call_id = toolCallId;
      const resultBlock = (msg.content as ContentBlock[]).find(
        (b) => b.type === 'tool_result',
      ) as ToolResultContent | undefined;
      const output = resultBlock?.output || '';
      // Detect image-type tool results — send text placeholder to avoid
      // API errors with non-vision models (e.g. DeepSeek). The screenshot
      // is still displayed in the UI via ScreenshotView component.
      try {
        const parsed = JSON.parse(output);
        if (parsed.type === 'image' && parsed.data) {
          result.content = 'Screenshot captured. Image is displayed in the chat UI.';
        } else {
          result.content = output;
        }
      } catch {
        result.content = output;
      }
    } else if (toolCalls.length > 0) {
      result.content = content.length > 0 ? content : null;
      result.tool_calls = toolCalls;
    } else {
      result.content = content.length === 1 && content[0].type === 'text'
        ? (content[0] as { type: 'text'; text: string }).text
        : content;
    }

    return result;
  }

  private formatTool(tool: ToolDefinition): OpenAITool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    };
  }

  private async *parseSSEStream(response: Response): AsyncGenerator<StreamEvent> {
    let usage: TokenUsage | null = null;
    const toolCallBuffers = new Map<number, OpenAIStreamToolCallBuffer>();

    for await (const data of readSSELines(response)) {
      if (data === '[DONE]') {
        yield* flushOpenAIStreamToolCallBuffers(toolCallBuffers);
        if (usage) yield { type: 'usage', usage };
        yield { type: 'done', stopReason: 'stop' };
        return;
      }

      try {
        const chunk = JSON.parse(data);
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
        }

        const choice = chunk.choices?.[0];
        if (!choice) continue;

        const delta = choice.delta;

        if (delta?.content) {
          yield { type: 'text_delta', text: delta.content };
        }

        if (delta?.reasoning_content) {
          yield { type: 'thinking_delta', thinking: delta.reasoning_content };
        }

        if (delta?.tool_calls) {
          for (const [position, tc] of delta.tool_calls.entries()) {
            yield* collectOpenAIStreamToolCallEvents(toolCallBuffers, tc, position);
          }
        }

        if (choice.finish_reason) {
          yield* flushOpenAIStreamToolCallBuffers(toolCallBuffers);
          if (usage) yield { type: 'usage', usage };
          yield { type: 'done', stopReason: choice.finish_reason };
          return;
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }

  private async *parseJSONResponse(response: Response): AsyncGenerator<StreamEvent> {
    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) throw new Error('No choices in response');

    if (choice.message?.reasoning_content) {
      yield { type: 'thinking_delta', thinking: choice.message.reasoning_content };
    }

    if (choice.message?.content) {
      yield { type: 'text_delta', text: choice.message.content };
    }

    if (choice.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        yield {
          type: 'tool_call_start',
          id: tc.id,
          name: tc.function.name,
        };
        yield {
          type: 'tool_call_end',
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        };
      }
    }

    if (data.usage) {
      yield {
        type: 'usage',
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
      };
    }

    yield {
      type: 'done',
      stopReason: choice.finish_reason || 'stop',
    };
  }

}

// ============================================================
// OpenAI API types (internal)
// ============================================================

interface OpenAIChatMessage {
  role: string;
  content: string | OpenAIContentPart[] | null;
  reasoning_content?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}
