import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AnthropicProvider,
  OpenAIProvider,
} from '@svton/agent-core';
import type {
  IProvider,
  StreamEvent,
  ChatMessage,
  ChatOptions,
  ModelInfo,
  ReasoningEffort,
} from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';

// ==============================================================
// Mock Helpers
// ==============================================================

/**
 * A provider that captures the ChatOptions it receives, so tests can
 * verify that reasoningEffort is threaded all the way through.
 */
class CaptureProvider implements IProvider {
  readonly name = 'capture';
  readonly models: ModelInfo[] = [];
  public lastOptions: ChatOptions | null = null;

  async *chat(
    _messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamEvent> {
    this.lastOptions = options;
    yield { type: 'done', stopReason: 'stop' };
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  supportsToolUse(_model: string): boolean {
    return true;
  }

  supportsVision(_model: string): boolean {
    return false;
  }
}

/**
 * Minimal runtime-like stub that exercises setReasoningEffort / getReasoningEffort
 * and builds ChatOptions in the same way the real runtime does.
 */
class RuntimeStub {
  private reasoningEffort: ReasoningEffort | undefined;
  private model = 'test-model';
  private provider: IProvider;

  constructor(provider: IProvider) {
    this.provider = provider;
  }

  setReasoningEffort(effort: ReasoningEffort | undefined): void {
    this.reasoningEffort = effort;
  }

  getReasoningEffort(): ReasoningEffort | undefined {
    return this.reasoningEffort;
  }

  /** Build chatOptions the same way AgentRuntime.run does */
  buildChatOptions(): ChatOptions {
    return {
      model: this.model,
      reasoningEffort: this.reasoningEffort,
    };
  }

  async callProvider(messages: ChatMessage[]): Promise<void> {
    const chatOptions = this.buildChatOptions();
    // Drain the generator so the provider records the options
    for await (const _event of this.provider.chat(messages, chatOptions)) {
      // consume
    }
  }
}

// ==============================================================
// Tests
// ==============================================================

describe('F14 — Reasoning Effort', () => {
  let captureProvider: CaptureProvider;

  beforeEach(() => {
    captureProvider = new CaptureProvider();
  });

  // ----------------------------------------------------------
  // ChatOptions threading
  // ----------------------------------------------------------
  describe('ChatOptions.reasoningEffort', () => {
    it('passes reasoningEffort through to the provider', async () => {
      const runtime = new RuntimeStub(captureProvider);
      runtime.setReasoningEffort('high');

      await runtime.callProvider([{ role: 'user', content: 'hello' }]);

      expect(captureProvider.lastOptions).not.toBeNull();
      expect(captureProvider.lastOptions!.reasoningEffort).toBe('high');
    });

    it('defaults to undefined when not set', async () => {
      const runtime = new RuntimeStub(captureProvider);

      await runtime.callProvider([{ role: 'user', content: 'hello' }]);

      expect(captureProvider.lastOptions).not.toBeNull();
      expect(captureProvider.lastOptions!.reasoningEffort).toBeUndefined();
    });

    it('preserves the model field alongside reasoningEffort', async () => {
      const runtime = new RuntimeStub(captureProvider);
      runtime.setReasoningEffort('medium');

      await runtime.callProvider([{ role: 'user', content: 'hello' }]);

      expect(captureProvider.lastOptions!.model).toBe('test-model');
      expect(captureProvider.lastOptions!.reasoningEffort).toBe('medium');
    });
  });

  // ----------------------------------------------------------
  // Runtime persistence
  // ----------------------------------------------------------
  describe('runtime.setReasoningEffort', () => {
    it('persists the effort level and returns it from getReasoningEffort', () => {
      const runtime = new RuntimeStub(captureProvider);

      runtime.setReasoningEffort('xhigh');
      expect(runtime.getReasoningEffort()).toBe('xhigh');
    });

    it('can be cleared by passing undefined', () => {
      const runtime = new RuntimeStub(captureProvider);
      runtime.setReasoningEffort('low');
      expect(runtime.getReasoningEffort()).toBe('low');

      runtime.setReasoningEffort(undefined);
      expect(runtime.getReasoningEffort()).toBeUndefined();
    });

    it('includes the value in built chatOptions', () => {
      const runtime = new RuntimeStub(captureProvider);
      runtime.setReasoningEffort('low');

      const opts = runtime.buildChatOptions();
      expect(opts.reasoningEffort).toBe('low');
    });
  });

  // ----------------------------------------------------------
  // Anthropic provider mapping
  // ----------------------------------------------------------
  describe('AnthropicProvider effort mapping', () => {
    /**
     * The Anthropic provider maps reasoningEffort to thinkingBudget.
     * The mapping is private, so we verify it indirectly by inspecting
     * the request body sent to fetch.
     */
    function createAnthropic(): AnthropicProvider {
      return new AnthropicProvider({ apiKey: 'test-key' });
    }

    async function captureRequestBody(
      provider: AnthropicProvider,
      effort: ReasoningEffort,
    ): Promise<Record<string, unknown>> {
      const calls: any[] = [];
      const origFetch = globalThis.fetch;
      (globalThis as any).fetch = vi.fn(async (_url: string, init: any) => {
        calls.push(init);
        return new Response(
          JSON.stringify({
            id: 'msg_test',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'ok' }],
            model: 'claude-sonnet-4',
            stop_reason: 'end_turn',
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      });

      try {
        const gen = provider.chat(
          [{ role: 'user', content: 'hi' }],
          {
            model: 'claude-sonnet-4-20250514',
            stream: false,
            reasoningEffort: effort,
          },
        );
        for await (const _ of gen) {
          // drain
        }
      } finally {
        (globalThis as any).fetch = origFetch;
      }

      return JSON.parse(calls[0].body);
    }

    it('maps low → thinkingBudget 1024', async () => {
      const provider = createAnthropic();
      const body = await captureRequestBody(provider, 'low');
      expect(body.thinking).toEqual({ type: 'enabled', budget_tokens: 1024 });
    });

    it('maps medium → thinkingBudget 4096', async () => {
      const provider = createAnthropic();
      const body = await captureRequestBody(provider, 'medium');
      expect(body.thinking).toEqual({ type: 'enabled', budget_tokens: 4096 });
    });

    it('maps high → thinkingBudget 10000', async () => {
      const provider = createAnthropic();
      const body = await captureRequestBody(provider, 'high');
      expect(body.thinking).toEqual({ type: 'enabled', budget_tokens: 10000 });
    });

    it('maps xhigh → thinkingBudget 32000', async () => {
      const provider = createAnthropic();
      const body = await captureRequestBody(provider, 'xhigh');
      expect(body.thinking).toEqual({ type: 'enabled', budget_tokens: 32000 });
    });
  });

  // ----------------------------------------------------------
  // OpenAI provider mapping
  // ----------------------------------------------------------
  describe('OpenAIProvider effort mapping', () => {
    function createOpenAI(): OpenAIProvider {
      return new OpenAIProvider({
        baseUrl: 'https://api.openai.com',
        apiKey: 'test-key',
        models: [
          {
            id: 'o3',
            name: 'o3',
            contextWindow: 200000,
            supportsToolUse: true,
            supportsVision: false,
            supportsStreaming: true,
          },
        ],
      });
    }

    async function captureRequestBody(
      provider: OpenAIProvider,
      effort: ReasoningEffort,
    ): Promise<Record<string, unknown>> {
      const calls: any[] = [];
      const origFetch = globalThis.fetch;
      (globalThis as any).fetch = vi.fn(async (_url: string, init: any) => {
        calls.push(init);
        return new Response(
          JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'ok' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      });

      try {
        const gen = provider.chat(
          [{ role: 'user', content: 'hi' }],
          {
            model: 'o3',
            stream: false,
            reasoningEffort: effort,
          },
        );
        for await (const _ of gen) {
          // drain
        }
      } finally {
        (globalThis as any).fetch = origFetch;
      }

      return JSON.parse(calls[0].body);
    }

    it('passes reasoning_effort="low" for low', async () => {
      const provider = createOpenAI();
      const body = await captureRequestBody(provider, 'low');
      expect(body.reasoning_effort).toBe('low');
    });

    it('passes reasoning_effort="medium" for medium', async () => {
      const provider = createOpenAI();
      const body = await captureRequestBody(provider, 'medium');
      expect(body.reasoning_effort).toBe('medium');
    });

    it('passes reasoning_effort="high" for high', async () => {
      const provider = createOpenAI();
      const body = await captureRequestBody(provider, 'high');
      expect(body.reasoning_effort).toBe('high');
    });

    it('caps xhigh to reasoning_effort="high"', async () => {
      const provider = createOpenAI();
      const body = await captureRequestBody(provider, 'xhigh');
      expect(body.reasoning_effort).toBe('high');
    });
  });
});
