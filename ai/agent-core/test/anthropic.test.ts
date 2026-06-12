import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ModelInfo, ChatMessage, ChatOptions, StreamEvent } from '@svton/agent-core';
import { AnthropicProvider } from '@svton/agent-core';

// ============================================================
// Helpers
// ============================================================

/** Build a ReadableStream from a string */
function stringToReadableStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

/** Create a mock Response for SSE streaming */
function createSSEResponse(sseData: string): Response {
  const headers = new Headers();
  headers.set('content-type', 'text/event-stream');
  return {
    ok: true,
    status: 200,
    headers,
    body: stringToReadableStream(sseData),
  } as Response;
}

/** Create a mock Response for JSON */
function createJSONResponse(data: unknown): Response {
  const headers = new Headers();
  headers.set('content-type', 'application/json');
  return {
    ok: true,
    status: 200,
    headers,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

/** Create a mock error Response */
function createErrorResponse(status: number, message: string): Response {
  return {
    ok: false,
    status,
    headers: new Headers(),
    text: async () => message,
  } as Response;
}

/** Collect all events from an async generator */
async function collectEvents(gen: AsyncGenerator<StreamEvent>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

/** Helper: minimal SSE stream that terminates with message_delta + stop_reason */
const minimalDone = 'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}\n';

// ============================================================
// Shared model definitions
// ============================================================

const anthropicModels: ModelInfo[] = [
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

// ============================================================
// AnthropicProvider Comprehensive Tests
// ============================================================

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    provider = new AnthropicProvider({
      apiKey: 'sk-ant-test-key',
      models: anthropicModels,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ----------------------------------------------------------
  // 1. Constructor
  // ----------------------------------------------------------

  describe('constructor', () => {
    it('sets name to "anthropic"', () => {
      expect(provider.name).toBe('anthropic');
    });

    it('sets default base URL when not provided', () => {
      // Verified indirectly: chat will call ${baseUrl}/v1/messages
      const p = new AnthropicProvider({ apiKey: 'key' });
      expect(p).toBeInstanceOf(AnthropicProvider);
    });

    it('uses custom base URL and strips trailing slashes', async () => {
      const p = new AnthropicProvider({
        apiKey: 'key',
        baseUrl: 'https://custom.anthropic.com///',
      });

      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      await collectEvents(p.chat([], { model: 'test' }));

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://custom.anthropic.com/v1/messages');
    });

    it('uses custom models when provided', () => {
      const customModels: ModelInfo[] = [
        {
          id: 'my-custom-model',
          name: 'Custom',
          contextWindow: 100000,
          supportsToolUse: false,
          supportsVision: false,
          supportsStreaming: true,
        },
      ];
      const p = new AnthropicProvider({ apiKey: 'key', models: customModels });
      expect(p.models).toEqual(customModels);
    });

    it('provides default models when none specified', () => {
      const p = new AnthropicProvider({ apiKey: 'key' });
      expect(p.models.length).toBeGreaterThanOrEqual(1);
      expect(p.models[0].id).toContain('claude');
    });

    it('stores custom headers', () => {
      const p = new AnthropicProvider({
        apiKey: 'key',
        customHeaders: { 'X-Tenant': 'acme' },
      });
      expect(p).toBeInstanceOf(AnthropicProvider);
    });
  });

  // ----------------------------------------------------------
  // 2. supportsToolUse
  // ----------------------------------------------------------

  describe('supportsToolUse', () => {
    it('returns true for a model with supportsToolUse: true', () => {
      expect(provider.supportsToolUse('claude-sonnet-4-20250514')).toBe(true);
      expect(provider.supportsToolUse('claude-haiku-4-20250506')).toBe(true);
    });

    it('returns true for unknown models (default behavior)', () => {
      expect(provider.supportsToolUse('nonexistent-model')).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 3. supportsVision
  // ----------------------------------------------------------

  describe('supportsVision', () => {
    it('returns true for models with supportsVision: true', () => {
      expect(provider.supportsVision('claude-sonnet-4-20250514')).toBe(true);
    });

    it('returns true for unknown models (default behavior)', () => {
      expect(provider.supportsVision('unknown-vision-model')).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 4. countTokens
  // ----------------------------------------------------------

  describe('countTokens', () => {
    it('delegates to heuristic: estimates ~4 chars per token for English', () => {
      // 20 English chars / 4 = 5 tokens
      expect(provider.countTokens('Hello world test1234')).toBe(5);
    });

    it('delegates to heuristic: estimates ~2 chars per token for CJK', () => {
      // 4 CJK chars / 2 = 2 tokens
      expect(provider.countTokens('你好世界')).toBe(2);
    });

    it('returns 0 for empty string', () => {
      expect(provider.countTokens('')).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // 5. chat — basic streaming text response
  // ----------------------------------------------------------

  describe('chat — basic streaming text', () => {
    it('parses message_start -> text_delta -> message_delta with done', async () => {
      const sseData = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}',
        'data: {"type":"content_block_start","content_block":{"type":"text"}}',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}',
        '',
      ].join('\n');

      mockFetch.mockResolvedValue(createSSEResponse(sseData));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514' }),
      );

      const textEvents = events.filter(e => e.type === 'text_delta');
      expect(textEvents).toEqual([
        { type: 'text_delta', text: 'Hello' },
        { type: 'text_delta', text: ' world' },
      ]);

      const doneEvents = events.filter(e => e.type === 'done');
      expect(doneEvents).toEqual([{ type: 'done', stopReason: 'end_turn' }]);

      const usageEvents = events.filter(e => e.type === 'usage');
      expect(usageEvents).toEqual([{
        type: 'usage',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      }]);
    });
  });

  // ----------------------------------------------------------
  // 6. chat — streaming with thinking
  // ----------------------------------------------------------

  describe('chat — streaming with thinking', () => {
    it('parses thinking_delta then text_delta events', async () => {
      const sseData = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":50}}}',
        'data: {"type":"content_block_start","content_block":{"type":"thinking"}}',
        'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"Let me analyze..."}}',
        'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":" Step by step."}}',
        'data: {"type":"content_block_start","content_block":{"type":"text"}}',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"The answer is 42."}}',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":30}}',
        '',
      ].join('\n');

      mockFetch.mockResolvedValue(createSSEResponse(sseData));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514' }),
      );

      const thinkingEvents = events.filter(e => e.type === 'thinking_delta');
      expect(thinkingEvents).toEqual([
        { type: 'thinking_delta', thinking: 'Let me analyze...' },
        { type: 'thinking_delta', thinking: ' Step by step.' },
      ]);

      const textEvents = events.filter(e => e.type === 'text_delta');
      expect(textEvents).toEqual([
        { type: 'text_delta', text: 'The answer is 42.' },
      ]);
    });
  });

  // ----------------------------------------------------------
  // 7. chat — streaming tool calls
  // ----------------------------------------------------------

  describe('chat — streaming tool calls', () => {
    it('parses tool_call_start -> tool_call_delta -> tool_call_end -> done', async () => {
      const sseData = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":15}}}',
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"tool_abc","name":"read_file"}}',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"path\\""}}',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":":\\"/tmp/test.ts\\"}"}}',
        'data: {"type":"content_block_stop","index":0}',
        'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":25}}',
        '',
      ].join('\n');

      mockFetch.mockResolvedValue(createSSEResponse(sseData));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514' }),
      );

      // tool_call_start
      const startEvents = events.filter(e => e.type === 'tool_call_start');
      expect(startEvents).toEqual([{
        type: 'tool_call_start',
        id: 'tool_abc',
        name: 'read_file',
      }]);

      // tool_call_delta (two partial JSON chunks)
      const deltaEvents = events.filter(e => e.type === 'tool_call_delta');
      expect(deltaEvents).toEqual([
        { type: 'tool_call_delta', id: 'tool_abc', argumentsDelta: '{"path"' },
        { type: 'tool_call_delta', id: 'tool_abc', argumentsDelta: ':"/tmp/test.ts"}' },
      ]);

      // tool_call_end — arguments should be the concatenation
      const endEvents = events.filter(e => e.type === 'tool_call_end');
      expect(endEvents).toEqual([{
        type: 'tool_call_end',
        id: 'tool_abc',
        name: 'read_file',
        arguments: '{"path":"/tmp/test.ts"}',
      }]);

      // done
      const doneEvents = events.filter(e => e.type === 'done');
      expect(doneEvents).toEqual([{ type: 'done', stopReason: 'tool_use' }]);
    });
  });

  // ----------------------------------------------------------
  // 8. chat — non-streaming JSON response with text
  // ----------------------------------------------------------

  describe('chat — non-streaming JSON with text', () => {
    it('parses content blocks and yields text_delta + usage + done', async () => {
      const jsonResponse = {
        content: [
          { type: 'text', text: 'Hello from Claude' },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      };

      mockFetch.mockResolvedValue(createJSONResponse(jsonResponse));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514', stream: false }),
      );

      expect(events).toContainEqual({ type: 'text_delta', text: 'Hello from Claude' });
      expect(events).toContainEqual({
        type: 'usage',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      });
      expect(events).toContainEqual({ type: 'done', stopReason: 'end_turn' });
    });
  });

  // ----------------------------------------------------------
  // 9. chat — non-streaming JSON response with tool_use
  // ----------------------------------------------------------

  describe('chat — non-streaming JSON with tool_use', () => {
    it('parses tool_use content blocks and yields tool_call_start + tool_call_end', async () => {
      const jsonResponse = {
        content: [
          { type: 'text', text: 'Let me run that.' },
          {
            type: 'tool_use',
            id: 'tool_xyz',
            name: 'bash',
            input: { command: 'ls -la' },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 10 },
        stop_reason: 'tool_use',
      };

      mockFetch.mockResolvedValue(createJSONResponse(jsonResponse));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514', stream: false }),
      );

      expect(events).toContainEqual({ type: 'text_delta', text: 'Let me run that.' });
      expect(events).toContainEqual({
        type: 'tool_call_start',
        id: 'tool_xyz',
        name: 'bash',
      });
      expect(events).toContainEqual({
        type: 'tool_call_end',
        id: 'tool_xyz',
        name: 'bash',
        arguments: '{"command":"ls -la"}',
      });
      expect(events).toContainEqual({ type: 'done', stopReason: 'tool_use' });
    });
  });

  // ----------------------------------------------------------
  // 10. chat — error response throws
  // ----------------------------------------------------------

  describe('chat — error handling', () => {
    it('throws on non-ok response with status and body', async () => {
      mockFetch.mockResolvedValue(createErrorResponse(429, 'Rate limited'));

      const gen = provider.chat([], { model: 'claude-sonnet-4-20250514' });
      await expect(collectEvents(gen)).rejects.toThrow('Anthropic API error (429): Rate limited');
    });

    it('throws on 401 unauthorized', async () => {
      mockFetch.mockResolvedValue(createErrorResponse(401, 'Invalid API key'));

      const gen = provider.chat([], { model: 'claude-sonnet-4-20250514' });
      await expect(collectEvents(gen)).rejects.toThrow('Anthropic API error (401)');
    });
  });

  // ----------------------------------------------------------
  // 11. chat — system messages extracted into system field
  // ----------------------------------------------------------

  describe('chat — system message handling', () => {
    it('extracts system messages into body.system field', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
      ];

      await collectEvents(
        provider.chat(messages, { model: 'claude-sonnet-4-20250514' }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.system).toBe('You are a helpful assistant.');
      // No system role in messages array
      expect(body.messages.every((m: { role: string }) => m.role !== 'system')).toBe(true);
    });

    it('concatenates multiple system messages with double newline', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      const messages: ChatMessage[] = [
        { role: 'system', content: 'Rule one.' },
        { role: 'system', content: 'Rule two.' },
        { role: 'user', content: 'Go' },
      ];

      await collectEvents(
        provider.chat(messages, { model: 'claude-sonnet-4-20250514' }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.system).toBe('Rule one.\n\nRule two.');
    });

    it('merges systemPrompt option with system messages', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      const messages: ChatMessage[] = [
        { role: 'system', content: 'From messages' },
        { role: 'user', content: 'Hi' },
      ];

      await collectEvents(
        provider.chat(messages, {
          model: 'claude-sonnet-4-20250514',
          systemPrompt: 'From options',
        }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.system).toContain('From options');
      expect(body.system).toContain('From messages');
    });

    it('omits system field when there are no system messages', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      await collectEvents(
        provider.chat(messages, { model: 'claude-sonnet-4-20250514' }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.system).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // 12. chat — consecutive same-role messages merged
  // ----------------------------------------------------------

  describe('chat — message merging', () => {
    it('merges consecutive same-role messages', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      const messages: ChatMessage[] = [
        { role: 'user', content: 'First user message' },
        { role: 'user', content: 'Second user message' },
        { role: 'assistant', content: 'Reply' },
        { role: 'assistant', content: 'More reply' },
      ];

      await collectEvents(
        provider.chat(messages, { model: 'claude-sonnet-4-20250514' }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      // Two user merged, two assistant merged => 2 messages
      expect(body.messages.length).toBe(2);
      expect(body.messages[0].role).toBe('user');
      expect(body.messages[1].role).toBe('assistant');
      // Merged content should be arrays
      expect(Array.isArray(body.messages[0].content)).toBe(true);
      expect(body.messages[0].content.length).toBe(2);
      expect(body.messages[1].content.length).toBe(2);
    });

    it('does not merge messages of different roles', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Q1' },
        { role: 'assistant', content: 'A1' },
        { role: 'user', content: 'Q2' },
      ];

      await collectEvents(
        provider.chat(messages, { model: 'claude-sonnet-4-20250514' }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.messages.length).toBe(3);
    });
  });

  // ----------------------------------------------------------
  // 13. chat — orphaned tool_use blocks sanitized
  // ----------------------------------------------------------

  describe('chat — tool_use sanitization', () => {
    it('removes tool_use blocks that have no matching tool_result', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      const messages: ChatMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Here is the result.' },
            { type: 'tool_use', id: 'orphan_tool_1', name: 'bash', input: { cmd: 'ls' } },
          ],
        },
        { role: 'user', content: 'Thanks' },
      ];

      await collectEvents(
        provider.chat(messages, { model: 'claude-sonnet-4-20250514' }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      const assistantMsg = body.messages[0];
      // Orphaned tool_use block should be removed; only text remains
      expect(assistantMsg.content.length).toBe(1);
      expect(assistantMsg.content[0].type).toBe('text');
      expect(assistantMsg.content[0].text).toBe('Here is the result.');
    });

    it('keeps tool_use blocks that have matching tool_result', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      const messages: ChatMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tool_matched', name: 'bash', input: { cmd: 'ls' } },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'tool_result', toolUseId: 'tool_matched', output: 'file.txt' },
          ],
        },
      ];

      await collectEvents(
        provider.chat(messages, { model: 'claude-sonnet-4-20250514' }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      const assistantMsg = body.messages[0];
      // tool_use should be kept since it has a matching tool_result
      expect(assistantMsg.content.some((b: { type: string }) => b.type === 'tool_use')).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 14. chat — thinkingBudget adds thinking config
  // ----------------------------------------------------------

  describe('chat — thinkingBudget', () => {
    it('adds thinking config and adjusts max_tokens', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514', thinkingBudget: 8000 }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.thinking).toEqual({
        type: 'enabled',
        budget_tokens: 8000,
      });
      // max_tokens = thinkingBudget + 16384 when no explicit maxTokens
      expect(body.max_tokens).toBe(8000 + 16384);
    });

    it('keeps explicit maxTokens when provided alongside thinkingBudget', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      await collectEvents(
        provider.chat([], {
          model: 'claude-sonnet-4-20250514',
          thinkingBudget: 5000,
          maxTokens: 20000,
        }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.thinking).toEqual({
        type: 'enabled',
        budget_tokens: 5000,
      });
      // Explicit maxTokens should be preserved
      expect(body.max_tokens).toBe(20000);
    });
  });

  // ----------------------------------------------------------
  // 15. chat — tools mapped to Anthropic format
  // ----------------------------------------------------------

  describe('chat — tool mapping', () => {
    it('maps tools to Anthropic format with input_schema', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      const tools = [
        {
          name: 'bash',
          description: 'Run a shell command',
          parameters: {
            type: 'object' as const,
            properties: { command: { type: 'string' } },
            required: ['command'],
          },
        },
        {
          name: 'read_file',
          description: 'Read a file',
          parameters: {
            type: 'object' as const,
            properties: { path: { type: 'string' } },
            required: ['path'],
          },
        },
      ];

      await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514', tools }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.tools).toHaveLength(2);
      expect(body.tools[0]).toEqual({
        name: 'bash',
        description: 'Run a shell command',
        input_schema: {
          type: 'object',
          properties: { command: { type: 'string' } },
          required: ['command'],
        },
      });
      expect(body.tools[1]).toEqual({
        name: 'read_file',
        description: 'Read a file',
        input_schema: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      });
    });

    it('does not include tools field when no tools provided', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514' }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.tools).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // 16. chat — custom headers sent
  // ----------------------------------------------------------

  describe('chat — custom headers', () => {
    it('sends x-api-key and anthropic-version headers', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      await collectEvents(provider.chat([], { model: 'claude-sonnet-4-20250514' }));

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers['x-api-key']).toBe('sk-ant-test-key');
      expect(init.headers['anthropic-version']).toBe('2023-06-01');
      expect(init.headers['Content-Type']).toBe('application/json');
    });

    it('includes custom headers alongside standard headers', async () => {
      const p = new AnthropicProvider({
        apiKey: 'key',
        models: anthropicModels,
        customHeaders: { 'X-Tenant': 'acme', 'X-Request-Id': 'req-123' },
      });

      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      await collectEvents(p.chat([], { model: 'claude-sonnet-4-20250514' }));

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers['X-Tenant']).toBe('acme');
      expect(init.headers['X-Request-Id']).toBe('req-123');
      // Standard headers still present
      expect(init.headers['x-api-key']).toBe('key');
    });
  });

  // ----------------------------------------------------------
  // 17. chat — signal passed to fetch
  // ----------------------------------------------------------

  describe('chat — signal', () => {
    it('passes AbortSignal to fetch', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      const controller = new AbortController();
      await collectEvents(
        provider.chat([], {
          model: 'claude-sonnet-4-20250514',
          signal: controller.signal,
        }),
      );

      const [, init] = mockFetch.mock.calls[0];
      expect(init.signal).toBe(controller.signal);
    });
  });

  // ----------------------------------------------------------
  // 18. chat — message formatting
  // ----------------------------------------------------------

  describe('chat — message formatting', () => {
    it('converts tool role to user role', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      const messages: ChatMessage[] = [
        {
          role: 'tool',
          content: [
            { type: 'tool_result', toolUseId: 'tool_1', output: 'result data' },
          ],
        },
      ];

      await collectEvents(
        provider.chat(messages, { model: 'claude-sonnet-4-20250514' }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.messages[0].role).toBe('user');
    });

    it('formats image ContentBlock for Anthropic API', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'image', data: 'iVBORw0KGgo=', mimeType: 'image/png' },
          ],
        },
      ];

      await collectEvents(
        provider.chat(messages, { model: 'claude-sonnet-4-20250514' }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      const block = body.messages[0].content[0];
      expect(block.type).toBe('image');
      expect(block.source.type).toBe('base64');
      expect(block.source.media_type).toBe('image/png');
      expect(block.source.data).toBe('iVBORw0KGgo=');
    });

    it('formats tool_use ContentBlock for Anthropic API', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      // Include matching tool_result so sanitizeToolUseChain does not strip it
      const messages: ChatMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tu_1', name: 'bash', input: { cmd: 'echo hi' } },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'tool_result', toolUseId: 'tu_1', output: 'hi' },
          ],
        },
      ];

      await collectEvents(
        provider.chat(messages, { model: 'claude-sonnet-4-20250514' }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      const block = body.messages[0].content[0];
      expect(block.type).toBe('tool_use');
      expect(block.id).toBe('tu_1');
      expect(block.name).toBe('bash');
      expect(block.input).toEqual({ cmd: 'echo hi' });
    });

    it('formats tool_result ContentBlock for Anthropic API', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'tool_result', toolUseId: 'tu_1', output: 'file contents', isError: false },
          ],
        },
      ];

      await collectEvents(
        provider.chat(messages, { model: 'claude-sonnet-4-20250514' }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      const block = body.messages[0].content[0];
      expect(block.type).toBe('tool_result');
      expect(block.tool_use_id).toBe('tu_1');
      expect(block.content).toBe('file contents');
      expect(block.is_error).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // 19. chat — request body defaults
  // ----------------------------------------------------------

  describe('chat — request body defaults', () => {
    it('sets max_tokens to 16384 by default', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      await collectEvents(provider.chat([], { model: 'claude-sonnet-4-20250514' }));

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.max_tokens).toBe(16384);
    });

    it('uses provided maxTokens', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514', maxTokens: 4096 }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.max_tokens).toBe(4096);
    });

    it('uses provided temperature', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514', temperature: 0.5 }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.temperature).toBe(0.5);
    });

    it('omits temperature when not provided', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      await collectEvents(provider.chat([], { model: 'claude-sonnet-4-20250514' }));

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.temperature).toBeUndefined();
    });

    it('sets stream true by default', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      await collectEvents(provider.chat([], { model: 'claude-sonnet-4-20250514' }));

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.stream).toBe(true);
    });

    it('sets stream false when stream: false', async () => {
      mockFetch.mockResolvedValue(createJSONResponse({
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
      }));

      await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514', stream: false }),
      );

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.stream).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // 20. chat — SSE edge cases
  // ----------------------------------------------------------

  describe('chat — SSE edge cases', () => {
    it('handles message_stop event', async () => {
      const sseData = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Done"}}',
        'data: {"type":"message_stop"}',
        '',
      ].join('\n');

      mockFetch.mockResolvedValue(createSSEResponse(sseData));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514' }),
      );

      const doneEvents = events.filter(e => e.type === 'done');
      expect(doneEvents).toEqual([{ type: 'done', stopReason: 'end_turn' }]);
    });

    it('yields usage from message_delta before done', async () => {
      const sseData = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":100}}}',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Ok"}}',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":50}}',
        '',
      ].join('\n');

      mockFetch.mockResolvedValue(createSSEResponse(sseData));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514' }),
      );

      // usage should come before done
      const usageIdx = events.findIndex(e => e.type === 'usage');
      const doneIdx = events.findIndex(e => e.type === 'done');
      expect(usageIdx).toBeLessThan(doneIdx);

      const usageEvent = events[usageIdx];
      expect(usageEvent).toEqual({
        type: 'usage',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
    });

    it('handles message_start without usage gracefully', async () => {
      const sseData = [
        'data: {"type":"message_start","message":{}}',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}',
        '',
      ].join('\n');

      mockFetch.mockResolvedValue(createSSEResponse(sseData));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514' }),
      );

      // No usage event because usage was null at message_start
      const usageEvents = events.filter(e => e.type === 'usage');
      expect(usageEvents).toEqual([]);
      // But text and done should still work
      const textEvents = events.filter(e => e.type === 'text_delta');
      expect(textEvents).toEqual([{ type: 'text_delta', text: 'Hello' }]);
    });

    it('skips malformed JSON in SSE stream', async () => {
      const sseData = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}',
        'data: not-valid-json',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Still works"}}',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":3}}',
        '',
      ].join('\n');

      mockFetch.mockResolvedValue(createSSEResponse(sseData));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514' }),
      );

      const textEvents = events.filter(e => e.type === 'text_delta');
      expect(textEvents).toEqual([{ type: 'text_delta', text: 'Still works' }]);
    });

    it('handles multiple tool calls in a single stream', async () => {
      const sseData = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":20}}}',
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"tool_a","name":"func_a"}}',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"x\\""}}',
        'data: {"type":"content_block_stop","index":0}',
        'data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"tool_b","name":"func_b"}}',
        'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"y\\"}}"}}',
        'data: {"type":"content_block_stop","index":1}',
        'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":40}}',
        '',
      ].join('\n');

      mockFetch.mockResolvedValue(createSSEResponse(sseData));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514' }),
      );

      const startEvents = events.filter(e => e.type === 'tool_call_start');
      expect(startEvents.length).toBe(2);

      const endEvents = events.filter(e => e.type === 'tool_call_end');
      expect(endEvents.length).toBe(2);
      expect(endEvents[0].name).toBe('func_a');
      expect(endEvents[1].name).toBe('func_b');
    });
  });

  // ----------------------------------------------------------
  // 21. chat — non-streaming edge cases
  // ----------------------------------------------------------

  describe('chat — non-streaming edge cases', () => {
    it('handles JSON response without usage', async () => {
      const jsonResponse = {
        content: [{ type: 'text', text: 'No usage info' }],
        stop_reason: 'end_turn',
      };

      mockFetch.mockResolvedValue(createJSONResponse(jsonResponse));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514', stream: false }),
      );

      expect(events).toContainEqual({ type: 'text_delta', text: 'No usage info' });
      expect(events).toContainEqual({ type: 'done', stopReason: 'end_turn' });
      // No usage event
      expect(events.filter(e => e.type === 'usage')).toEqual([]);
    });

    it('defaults stopReason to "end_turn" when not in response', async () => {
      const jsonResponse = {
        content: [{ type: 'text', text: 'Ok' }],
        usage: { input_tokens: 5, output_tokens: 2 },
      };

      mockFetch.mockResolvedValue(createJSONResponse(jsonResponse));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514', stream: false }),
      );

      expect(events).toContainEqual({ type: 'done', stopReason: 'end_turn' });
    });
  });

  // ----------------------------------------------------------
  // 22. chat — URL construction
  // ----------------------------------------------------------

  describe('chat — URL construction', () => {
    it('calls correct endpoint with default baseUrl', async () => {
      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      await collectEvents(provider.chat([], { model: 'test-model' }));

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.anthropic.com/v1/messages');
    });

    it('calls correct endpoint with custom baseUrl (no trailing slash)', async () => {
      const p = new AnthropicProvider({
        apiKey: 'key',
        baseUrl: 'https://proxy.example.com',
        models: anthropicModels,
      });

      mockFetch.mockResolvedValue(createSSEResponse(minimalDone));

      await collectEvents(p.chat([], { model: 'test-model' }));

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://proxy.example.com/v1/messages');
    });
  });
});
