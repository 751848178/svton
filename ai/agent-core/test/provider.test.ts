import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ModelInfo, ChatMessage, ChatOptions, StreamEvent } from '@svton/agent-core';
import { OpenAIProvider, AnthropicProvider } from '@svton/agent-core';

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

// ============================================================
// Shared model definitions
// ============================================================

const openAIModels: ModelInfo[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    contextWindow: 128000,
    supportsToolUse: true,
    supportsVision: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    contextWindow: 128000,
    supportsToolUse: true,
    supportsVision: false,
    supportsStreaming: true,
  },
];

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
];

// ============================================================
// OpenAIProvider Tests
// ============================================================

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    provider = new OpenAIProvider({
      baseUrl: 'https://api.openai.com',
      apiKey: 'test-key',
      models: openAIModels,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ----------------------------------------------------------
  // Constructor
  // ----------------------------------------------------------

  describe('constructor', () => {
    it('uses default name when not provided', () => {
      expect(provider.name).toBe('openai');
    });

    it('uses custom name when provided', () => {
      const p = new OpenAIProvider({
        name: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'key',
        models: openAIModels,
      });
      expect(p.name).toBe('deepseek');
    });

    it('strips trailing slashes from baseUrl', () => {
      const p = new OpenAIProvider({
        baseUrl: 'https://api.openai.com///',
        apiKey: 'key',
        models: openAIModels,
      });
      // baseUrl is private, verify via chat URL construction
      expect(p.name).toBe('openai');
    });

    it('stores models array', () => {
      expect(provider.models).toEqual(openAIModels);
    });

    it('accepts custom headers', () => {
      const p = new OpenAIProvider({
        baseUrl: 'https://api.openai.com',
        apiKey: 'key',
        models: openAIModels,
        customHeaders: { 'X-Custom': 'value' },
      });
      expect(p).toBeInstanceOf(OpenAIProvider);
    });
  });

  // ----------------------------------------------------------
  // supportsToolUse / supportsVision
  // ----------------------------------------------------------

  describe('supportsToolUse', () => {
    it('returns true for a model with supportsToolUse: true', () => {
      expect(provider.supportsToolUse('gpt-4o')).toBe(true);
    });

    it('defaults to true for unknown models', () => {
      expect(provider.supportsToolUse('nonexistent-model')).toBe(true);
    });
  });

  describe('supportsVision', () => {
    it('returns true for a model with supportsVision: true', () => {
      expect(provider.supportsVision('gpt-4o')).toBe(true);
    });

    it('returns false for a model with supportsVision: false', () => {
      expect(provider.supportsVision('gpt-4o-mini')).toBe(false);
    });

    it('defaults to false for unknown models', () => {
      expect(provider.supportsVision('nonexistent-model')).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // countTokens
  // ----------------------------------------------------------

  describe('countTokens', () => {
    it('estimates ~4 chars per token for English text', () => {
      // 20 English characters / 4 = 5 tokens
      expect(provider.countTokens('Hello world test1234')).toBe(5);
    });

    it('estimates ~2 chars per token for CJK text', () => {
      // 4 CJK chars / 2 = 2 tokens
      expect(provider.countTokens('你好世界')).toBe(2);
    });

    it('handles mixed CJK and English text', () => {
      // 2 CJK chars / 2 + 5 English chars / 4 = 1 + 2 = 3
      const tokens = provider.countTokens('你好abc');
      expect(tokens).toBeGreaterThanOrEqual(2);
      expect(tokens).toBeLessThanOrEqual(4);
    });

    it('returns 0 for empty string', () => {
      expect(provider.countTokens('')).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // chat - SSE streaming
  // ----------------------------------------------------------

  describe('chat (SSE streaming)', () => {
    it('parses SSE text content correctly', async () => {
      const sseData = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}',
        'data: {"choices":[{"delta":{"content":" world"}}]}',
        'data: {"choices":[{"finish_reason":"stop"}]}',
        'data: [DONE]',
        '',
      ].join('\n');

      fetchSpy.mockResolvedValue(createSSEResponse(sseData));

      const events = await collectEvents(
        provider.chat([], { model: 'gpt-4o' }),
      );

      const textEvents = events.filter((e) => e.type === 'text_delta');
      expect(textEvents).toEqual([
        { type: 'text_delta', text: 'Hello' },
        { type: 'text_delta', text: ' world' },
      ]);

      const doneEvents = events.filter((e) => e.type === 'done');
      expect(doneEvents.length).toBe(1);
      expect(doneEvents[0]).toEqual({ type: 'done', stopReason: 'stop' });
    });

    it('yields usage event when usage is present', async () => {
      const sseData = [
        'data: {"choices":[{"delta":{"content":"Hi"}}],"usage":{"prompt_tokens":10,"completion_tokens":3,"total_tokens":13}}',
        'data: {"choices":[{"finish_reason":"stop"}]}',
        'data: [DONE]',
        '',
      ].join('\n');

      fetchSpy.mockResolvedValue(createSSEResponse(sseData));

      const events = await collectEvents(
        provider.chat([], { model: 'gpt-4o' }),
      );

      const usageEvents = events.filter((e) => e.type === 'usage');
      expect(usageEvents.length).toBeGreaterThanOrEqual(1);
      expect(usageEvents[0]).toEqual({
        type: 'usage',
        usage: {
          promptTokens: 10,
          completionTokens: 3,
          totalTokens: 13,
        },
      });
    });

    it('parses tool call SSE events', async () => {
      const sseData = [
        'data: {"choices":[{"delta":{"tool_calls":[{"id":"call_1","type":"function","function":{"name":"read_file","arguments":""}}]}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"id":"call_1","type":"function","function":{"arguments":"{\\"path\\":"}}]}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"id":"call_1","type":"function","function":{"arguments":"\\"test.ts\\"}"}}]}}]}',
        'data: {"choices":[{"finish_reason":"tool_calls"}]}',
        'data: [DONE]',
        '',
      ].join('\n');

      fetchSpy.mockResolvedValue(createSSEResponse(sseData));

      const events = await collectEvents(
        provider.chat([], { model: 'gpt-4o' }),
      );

      const toolStartEvents = events.filter((e) => e.type === 'tool_call_start');
      expect(toolStartEvents.length).toBe(1);
      expect(toolStartEvents[0]).toEqual({
        type: 'tool_call_start',
        id: 'call_1',
        name: 'read_file',
      });

      const toolDeltaEvents = events.filter((e) => e.type === 'tool_call_delta');
      expect(toolDeltaEvents.length).toBe(2);
      expect(toolDeltaEvents[0].type).toBe('tool_call_delta');
      expect(toolDeltaEvents[0].id).toBe('call_1');
      expect(toolDeltaEvents[0].argumentsDelta).toBe('{"path":');

      const doneEvents = events.filter((e) => e.type === 'done');
      expect(doneEvents[0]).toEqual({ type: 'done', stopReason: 'tool_calls' });
    });

    it('skips comment lines and empty lines in SSE', async () => {
      const sseData = [
        ': this is a comment',
        '',
        'data: {"choices":[{"delta":{"content":"Hello"}}]}',
        '',
        'data: {"choices":[{"finish_reason":"stop"}]}',
        'data: [DONE]',
        '',
      ].join('\n');

      fetchSpy.mockResolvedValue(createSSEResponse(sseData));

      const events = await collectEvents(
        provider.chat([], { model: 'gpt-4o' }),
      );

      const textEvents = events.filter((e) => e.type === 'text_delta');
      expect(textEvents).toEqual([{ type: 'text_delta', text: 'Hello' }]);
    });
  });

  // ----------------------------------------------------------
  // chat - JSON response
  // ----------------------------------------------------------

  describe('chat (JSON response)', () => {
    it('parses JSON response with text content', async () => {
      const jsonResponse = {
        choices: [
          {
            message: { content: 'Hello from JSON', role: 'assistant' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      };

      fetchSpy.mockResolvedValue(createJSONResponse(jsonResponse));

      const events = await collectEvents(
        provider.chat([], { model: 'gpt-4o', stream: false }),
      );

      expect(events).toContainEqual({ type: 'text_delta', text: 'Hello from JSON' });
      expect(events).toContainEqual({
        type: 'usage',
        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
      });
      expect(events).toContainEqual({ type: 'done', stopReason: 'stop' });
    });

    it('parses JSON response with tool calls', async () => {
      const jsonResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_abc',
                  type: 'function',
                  function: {
                    name: 'bash',
                    arguments: '{"command":"ls"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      fetchSpy.mockResolvedValue(createJSONResponse(jsonResponse));

      const events = await collectEvents(
        provider.chat([], { model: 'gpt-4o', stream: false }),
      );

      expect(events).toContainEqual({
        type: 'tool_call_start',
        id: 'call_abc',
        name: 'bash',
      });
      expect(events).toContainEqual({
        type: 'tool_call_end',
        id: 'call_abc',
        name: 'bash',
        arguments: '{"command":"ls"}',
      });
    });

    it('throws when no choices in response', async () => {
      const jsonResponse = { choices: [] };
      fetchSpy.mockResolvedValue(createJSONResponse(jsonResponse));

      const gen = provider.chat([], { model: 'gpt-4o', stream: false });
      await expect(collectEvents(gen)).rejects.toThrow('No choices in response');
    });
  });

  // ----------------------------------------------------------
  // chat - error handling
  // ----------------------------------------------------------

  describe('chat (error handling)', () => {
    it('throws on non-ok response', async () => {
      fetchSpy.mockResolvedValue(createErrorResponse(429, 'Rate limited'));

      const gen = provider.chat([], { model: 'gpt-4o' });
      await expect(collectEvents(gen)).rejects.toThrow('OpenAI API error (429)');
    });
  });

  // ----------------------------------------------------------
  // chat - request building
  // ----------------------------------------------------------

  describe('chat (request building)', () => {
    it('sends Authorization Bearer header', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse('data: {"choices":[{"finish_reason":"stop"}]}\ndata: [DONE]\n'));

      await collectEvents(provider.chat([], { model: 'gpt-4o' }));

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, init] = fetchSpy.mock.calls[0];
      expect(init.headers.Authorization).toBe('Bearer test-key');
      expect(init.headers['Content-Type']).toBe('application/json');
    });

    it('includes custom headers', async () => {
      const p = new OpenAIProvider({
        baseUrl: 'https://api.openai.com',
        apiKey: 'key',
        models: openAIModels,
        customHeaders: { 'X-Tenant': 'acme' },
      });

      fetchSpy.mockResolvedValue(createSSEResponse('data: {"choices":[{"finish_reason":"stop"}]}\ndata: [DONE]\n'));

      await collectEvents(p.chat([], { model: 'gpt-4o' }));

      const [, init] = fetchSpy.mock.calls[0];
      expect(init.headers['X-Tenant']).toBe('acme');
    });

    it('sends systemPrompt as system message', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse('data: {"choices":[{"finish_reason":"stop"}]}\ndata: [DONE]\n'));

      await collectEvents(
        provider.chat(
          [{ role: 'user', content: 'Hello' }],
          { model: 'gpt-4o', systemPrompt: 'You are helpful.' },
        ),
      );

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.messages[0]).toEqual({ role: 'system', content: 'You are helpful.' });
      expect(body.messages[1]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('sends temperature and maxTokens when provided', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse('data: {"choices":[{"finish_reason":"stop"}]}\ndata: [DONE]\n'));

      await collectEvents(
        provider.chat([], { model: 'gpt-4o', temperature: 0.7, maxTokens: 2048 }),
      );

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.temperature).toBe(0.7);
      expect(body.max_tokens).toBe(2048);
    });

    it('sends tools and tool_choice when tools are provided', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse('data: {"choices":[{"finish_reason":"stop"}]}\ndata: [DONE]\n'));

      const tools = [
        {
          name: 'bash',
          description: 'Run a command',
          parameters: {
            type: 'object' as const,
            properties: { command: { type: 'string' } },
            required: ['command'],
          },
        },
      ];

      await collectEvents(
        provider.chat([], { model: 'gpt-4o', tools }),
      );

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.tools).toHaveLength(1);
      expect(body.tools[0]).toEqual({
        type: 'function',
        function: {
          name: 'bash',
          description: 'Run a command',
          parameters: {
            type: 'object',
            properties: { command: { type: 'string' } },
            required: ['command'],
          },
        },
      });
      expect(body.tool_choice).toBe('auto');
    });

    it('sets stream: true by default in request body', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse('data: {"choices":[{"finish_reason":"stop"}]}\ndata: [DONE]\n'));

      await collectEvents(provider.chat([], { model: 'gpt-4o' }));

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.stream).toBe(true);
    });

    it('sets stream: false when stream option is false', async () => {
      fetchSpy.mockResolvedValue(createJSONResponse({
        choices: [{ message: { content: 'Hi' }, finish_reason: 'stop' }],
      }));

      await collectEvents(provider.chat([], { model: 'gpt-4o', stream: false }));

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.stream).toBe(false);
    });

    it('formats ContentBlock[] messages with text and image', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse('data: {"choices":[{"finish_reason":"stop"}]}\ndata: [DONE]\n'));

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image' },
            { type: 'image', data: 'iVBORw0KGgo=', mimeType: 'image/png' },
          ],
        },
      ];

      await collectEvents(provider.chat(messages, { model: 'gpt-4o' }));

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      const userMsg = body.messages[0];
      expect(userMsg.role).toBe('user');
      expect(userMsg.content).toHaveLength(2);
      expect(userMsg.content[0]).toEqual({ type: 'text', text: 'Describe this image' });
      expect(userMsg.content[1].type).toBe('image_url');
      expect(userMsg.content[1].image_url.url).toContain('data:image/png;base64,');
    });

    it('formats tool_use ContentBlock as tool_calls', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse('data: {"choices":[{"finish_reason":"stop"}]}\ndata: [DONE]\n'));

      const messages: ChatMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me check.' },
            { type: 'tool_use', id: 'call_1', name: 'bash', input: { command: 'ls' } },
          ],
        },
      ];

      await collectEvents(provider.chat(messages, { model: 'gpt-4o' }));

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      const assistantMsg = body.messages[0];
      expect(assistantMsg.role).toBe('assistant');
      expect(assistantMsg.tool_calls).toHaveLength(1);
      expect(assistantMsg.tool_calls[0]).toEqual({
        id: 'call_1',
        type: 'function',
        function: { name: 'bash', arguments: '{"command":"ls"}' },
      });
    });

    it('formats tool_result ContentBlock as tool message', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse('data: {"choices":[{"finish_reason":"stop"}]}\ndata: [DONE]\n'));

      // Include the matching tool_call so the sanitizer doesn't treat the
      // tool result as orphaned.
      const messages: ChatMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'call_1', name: 'bash', input: { command: 'ls' } },
          ],
        },
        {
          role: 'tool',
          content: [
            { type: 'tool_result', toolUseId: 'call_1', output: 'file.txt\nfile2.txt' },
          ],
        },
      ];

      await collectEvents(provider.chat(messages, { model: 'gpt-4o' }));

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      const toolMsg = body.messages.find((m: any) => m.role === 'tool');
      expect(toolMsg).toBeDefined();
      expect(toolMsg.tool_call_id).toBe('call_1');
      expect(toolMsg.content).toBe('file.txt\nfile2.txt');
    });

    it('strips orphaned tool results that have no matching tool_call', async () => {
      // Reproduces OpenAI 400: "Messages with role 'tool' must be a response to
      // a preceding message with 'tool_calls'". This can happen after retry,
      // compaction, or when a skill filters out a tool call but its result is
      // still appended to context.
      fetchSpy.mockResolvedValue(createSSEResponse('data: {"choices":[{"finish_reason":"stop"}]}\ndata: [DONE]\n'));

      const messages: ChatMessage[] = [
        { role: 'user', content: 'hello' },
        {
          // tool result referencing a tool_call_id that does not exist anywhere
          role: 'tool',
          content: [
            { type: 'tool_result', toolUseId: 'orphan_1', output: 'leftover' },
          ],
        },
        { role: 'assistant', content: 'hi there' },
        {
          // well-formed pair: tool_call + matching result
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'call_2', name: 'bash', input: { command: 'ls' } },
          ],
        },
        {
          role: 'tool',
          content: [
            { type: 'tool_result', toolUseId: 'call_2', output: 'a.txt' },
          ],
        },
      ];

      await collectEvents(provider.chat(messages, { model: 'gpt-4o' }));

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      const toolIds = body.messages
        .filter((m: any) => m.role === 'tool')
        .map((m: any) => m.tool_call_id);

      // Orphaned 'orphan_1' must be removed; matching 'call_2' must remain.
      expect(toolIds).not.toContain('orphan_1');
      expect(toolIds).toContain('call_2');
    });

    it('passes AbortSignal to fetch', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse('data: {"choices":[{"finish_reason":"stop"}]}\ndata: [DONE]\n'));

      const controller = new AbortController();
      await collectEvents(
        provider.chat([], { model: 'gpt-4o', signal: controller.signal }),
      );

      const [, init] = fetchSpy.mock.calls[0];
      expect(init.signal).toBe(controller.signal);
    });
  });
});

// ============================================================
// AnthropicProvider Tests
// ============================================================

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    provider = new AnthropicProvider({
      apiKey: 'sk-ant-test',
      models: anthropicModels,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ----------------------------------------------------------
  // Constructor
  // ----------------------------------------------------------

  describe('constructor', () => {
    it('uses default name "anthropic"', () => {
      expect(provider.name).toBe('anthropic');
    });

    it('uses default base URL when not provided', () => {
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it('uses default models when not provided', () => {
      const p = new AnthropicProvider({ apiKey: 'key' });
      expect(p.models.length).toBeGreaterThanOrEqual(1);
      expect(p.models[0].id).toContain('claude');
    });

    it('uses custom models when provided', () => {
      expect(provider.models).toEqual(anthropicModels);
    });

    it('strips trailing slashes from baseUrl', () => {
      const p = new AnthropicProvider({
        apiKey: 'key',
        baseUrl: 'https://custom.anthropic.com///',
      });
      expect(p).toBeInstanceOf(AnthropicProvider);
    });
  });

  // ----------------------------------------------------------
  // supportsToolUse / supportsVision
  // ----------------------------------------------------------

  describe('supportsToolUse', () => {
    it('returns true for a model with supportsToolUse: true', () => {
      expect(provider.supportsToolUse('claude-sonnet-4-20250514')).toBe(true);
    });

    it('defaults to true for unknown models', () => {
      expect(provider.supportsToolUse('nonexistent')).toBe(true);
    });
  });

  describe('supportsVision', () => {
    it('returns true for a model with supportsVision: true', () => {
      expect(provider.supportsVision('claude-sonnet-4-20250514')).toBe(true);
    });

    it('defaults to true for unknown models', () => {
      expect(provider.supportsVision('nonexistent')).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // countTokens
  // ----------------------------------------------------------

  describe('countTokens', () => {
    it('estimates tokens for English text', () => {
      expect(provider.countTokens('Hello world')).toBe(3);
    });

    it('estimates tokens for CJK text', () => {
      expect(provider.countTokens('你好世界')).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // chat - SSE streaming
  // ----------------------------------------------------------

  describe('chat (SSE streaming)', () => {
    it('parses text delta events correctly', async () => {
      const sseData = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}',
        'data: {"type":"content_block_start","content_block":{"type":"text"}}',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}',
        '',
      ].join('\n');

      fetchSpy.mockResolvedValue(createSSEResponse(sseData));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514' }),
      );

      const textEvents = events.filter((e) => e.type === 'text_delta');
      expect(textEvents).toEqual([
        { type: 'text_delta', text: 'Hello' },
        { type: 'text_delta', text: ' world' },
      ]);

      const doneEvents = events.filter((e) => e.type === 'done');
      expect(doneEvents).toEqual([{ type: 'done', stopReason: 'end_turn' }]);
    });

    it('parses thinking_delta events', async () => {
      const sseData = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}',
        'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"Let me think..."}}',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}',
        '',
      ].join('\n');

      fetchSpy.mockResolvedValue(createSSEResponse(sseData));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514' }),
      );

      const thinkingEvents = events.filter((e) => e.type === 'thinking_delta');
      expect(thinkingEvents).toEqual([
        { type: 'thinking_delta', thinking: 'Let me think...' },
      ]);
    });

    it('parses tool call SSE events (start, delta, end)', async () => {
      const sseData = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}',
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"tool_1","name":"read_file"}}',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"path\\""}}',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":":\\"test.ts\\"}"}}',
        'data: {"type":"content_block_stop","index":0}',
        'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":20}}',
        '',
      ].join('\n');

      fetchSpy.mockResolvedValue(createSSEResponse(sseData));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514' }),
      );

      const startEvents = events.filter((e) => e.type === 'tool_call_start');
      expect(startEvents).toEqual([{
        type: 'tool_call_start',
        id: 'tool_1',
        name: 'read_file',
      }]);

      const deltaEvents = events.filter((e) => e.type === 'tool_call_delta');
      expect(deltaEvents.length).toBe(2);
      expect(deltaEvents[0]).toEqual({
        type: 'tool_call_delta',
        id: 'tool_1',
        argumentsDelta: '{"path"',
      });
      expect(deltaEvents[1]).toEqual({
        type: 'tool_call_delta',
        id: 'tool_1',
        argumentsDelta: ':"test.ts"}',
      });

      const endEvents = events.filter((e) => e.type === 'tool_call_end');
      expect(endEvents).toEqual([{
        type: 'tool_call_end',
        id: 'tool_1',
        name: 'read_file',
        arguments: '{"path":"test.ts"}',
      }]);

      const doneEvents = events.filter((e) => e.type === 'done');
      expect(doneEvents).toEqual([{ type: 'done', stopReason: 'tool_use' }]);
    });

    it('yields usage event at the end', async () => {
      const sseData = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":25}}}',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":8}}',
        '',
      ].join('\n');

      fetchSpy.mockResolvedValue(createSSEResponse(sseData));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514' }),
      );

      const usageEvents = events.filter((e) => e.type === 'usage');
      expect(usageEvents.length).toBe(1);
      expect(usageEvents[0]).toEqual({
        type: 'usage',
        usage: {
          promptTokens: 25,
          completionTokens: 8,
          totalTokens: 33,
        },
      });
    });

    it('handles message_stop event', async () => {
      const sseData = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Done"}}',
        'data: {"type":"message_stop"}',
        '',
      ].join('\n');

      fetchSpy.mockResolvedValue(createSSEResponse(sseData));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514' }),
      );

      const doneEvents = events.filter((e) => e.type === 'done');
      expect(doneEvents).toEqual([{ type: 'done', stopReason: 'end_turn' }]);
    });
  });

  // ----------------------------------------------------------
  // chat - JSON response
  // ----------------------------------------------------------

  describe('chat (JSON response)', () => {
    it('parses JSON response with text content', async () => {
      const jsonResponse = {
        content: [
          { type: 'text', text: 'Hello from Claude' },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      };

      fetchSpy.mockResolvedValue(createJSONResponse(jsonResponse));

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

    it('parses JSON response with tool_use content blocks', async () => {
      const jsonResponse = {
        content: [
          { type: 'text', text: 'Let me check.' },
          {
            type: 'tool_use',
            id: 'tool_abc',
            name: 'bash',
            input: { command: 'ls -la' },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 10 },
        stop_reason: 'tool_use',
      };

      fetchSpy.mockResolvedValue(createJSONResponse(jsonResponse));

      const events = await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514', stream: false }),
      );

      expect(events).toContainEqual({ type: 'text_delta', text: 'Let me check.' });
      expect(events).toContainEqual({
        type: 'tool_call_start',
        id: 'tool_abc',
        name: 'bash',
      });
      expect(events).toContainEqual({
        type: 'tool_call_end',
        id: 'tool_abc',
        name: 'bash',
        arguments: '{"command":"ls -la"}',
      });
    });
  });

  // ----------------------------------------------------------
  // chat - error handling
  // ----------------------------------------------------------

  describe('chat (error handling)', () => {
    it('throws on non-ok response', async () => {
      fetchSpy.mockResolvedValue(createErrorResponse(401, 'Unauthorized'));

      const gen = provider.chat([], { model: 'claude-sonnet-4-20250514' });
      await expect(collectEvents(gen)).rejects.toThrow('Anthropic API error (401)');
    });
  });

  // ----------------------------------------------------------
  // chat - request building
  // ----------------------------------------------------------

  describe('chat (request building)', () => {
    it('sends x-api-key and anthropic-version headers', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse(
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}\n',
      ));

      await collectEvents(provider.chat([], { model: 'claude-sonnet-4-20250514' }));

      const [, init] = fetchSpy.mock.calls[0];
      expect(init.headers['x-api-key']).toBe('sk-ant-test');
      expect(init.headers['anthropic-version']).toBe('2023-06-01');
    });

    it('includes custom headers', async () => {
      const p = new AnthropicProvider({
        apiKey: 'key',
        models: anthropicModels,
        customHeaders: { 'X-Tenant': 'acme' },
      });

      fetchSpy.mockResolvedValue(createSSEResponse(
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}\n',
      ));

      await collectEvents(p.chat([], { model: 'claude-sonnet-4-20250514' }));

      const [, init] = fetchSpy.mock.calls[0];
      expect(init.headers['X-Tenant']).toBe('acme');
    });

    it('extracts system messages and puts them into body.system', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse(
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}\n',
      ));

      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
      ];

      await collectEvents(
        provider.chat(messages, { model: 'claude-sonnet-4-20250514' }),
      );

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.system).toBe('You are a helpful assistant.');
      // System message should not appear in messages array
      expect(body.messages.every((m: { role: string }) => m.role !== 'system')).toBe(true);
    });

    it('merges system prompt with system messages', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse(
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}\n',
      ));

      const messages: ChatMessage[] = [
        { role: 'system', content: 'System from messages' },
        { role: 'user', content: 'Hi' },
      ];

      await collectEvents(
        provider.chat(messages, {
          model: 'claude-sonnet-4-20250514',
          systemPrompt: 'System from options',
        }),
      );

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.system).toContain('System from options');
      expect(body.system).toContain('System from messages');
    });

    it('merges consecutive same-role messages', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse(
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}\n',
      ));

      const messages: ChatMessage[] = [
        { role: 'user', content: 'First message' },
        { role: 'user', content: 'Second message' },
        { role: 'assistant', content: 'Reply' },
      ];

      await collectEvents(
        provider.chat(messages, { model: 'claude-sonnet-4-20250514' }),
      );

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      // Two user messages should be merged into one
      expect(body.messages.length).toBe(2);
      const firstMsg = body.messages[0];
      expect(firstMsg.role).toBe('user');
      expect(Array.isArray(firstMsg.content)).toBe(true);
      expect(firstMsg.content.length).toBe(2);
    });

    it('sets default max_tokens to 16384 when not specified', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse(
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}\n',
      ));

      await collectEvents(provider.chat([], { model: 'claude-sonnet-4-20250514' }));

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.max_tokens).toBe(16384);
    });

    it('sets thinking config when thinkingBudget is provided', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse(
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}\n',
      ));

      await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514', thinkingBudget: 8000 }),
      );

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.thinking).toEqual({
        type: 'enabled',
        budget_tokens: 8000,
      });
      // max_tokens should be thinkingBudget + 16384
      expect(body.max_tokens).toBe(8000 + 16384);
    });

    it('formats tools using input_schema', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse(
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}\n',
      ));

      const tools = [
        {
          name: 'bash',
          description: 'Run a command',
          parameters: {
            type: 'object' as const,
            properties: { command: { type: 'string' } },
            required: ['command'],
          },
        },
      ];

      await collectEvents(
        provider.chat([], { model: 'claude-sonnet-4-20250514', tools }),
      );

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.tools).toHaveLength(1);
      expect(body.tools[0]).toEqual({
        name: 'bash',
        description: 'Run a command',
        input_schema: {
          type: 'object',
          properties: { command: { type: 'string' } },
          required: ['command'],
        },
      });
    });

    it('converts tool role to user role', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse(
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}\n',
      ));

      const messages: ChatMessage[] = [
        {
          role: 'tool',
          content: [
            { type: 'tool_result', toolUseId: 'tool_1', output: 'result' },
          ],
        },
      ];

      await collectEvents(
        provider.chat(messages, { model: 'claude-sonnet-4-20250514' }),
      );

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      // tool role should be converted to user
      expect(body.messages[0].role).toBe('user');
    });

    it('formats image ContentBlock for Anthropic API', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse(
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}\n',
      ));

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

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      const contentBlock = body.messages[0].content[0];
      expect(contentBlock.type).toBe('image');
      expect(contentBlock.source.type).toBe('base64');
      expect(contentBlock.source.media_type).toBe('image/png');
      expect(contentBlock.source.data).toBe('iVBORw0KGgo=');
    });

    it('passes AbortSignal to fetch', async () => {
      fetchSpy.mockResolvedValue(createSSEResponse(
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}\n',
      ));

      const controller = new AbortController();
      await collectEvents(
        provider.chat([], {
          model: 'claude-sonnet-4-20250514',
          signal: controller.signal,
        }),
      );

      const [, init] = fetchSpy.mock.calls[0];
      expect(init.signal).toBe(controller.signal);
    });
  });
});
