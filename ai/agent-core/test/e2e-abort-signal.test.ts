import { describe, expect, it, vi } from 'vitest';
import { AgentRuntime } from '../src/agent/runtime';
import { ToolRegistry } from '../src/tool/registry';
import { WebFetchExecutor, webFetchDef } from '../src/tool/builtins/web';
import type { IProvider, ChatMessage, ChatOptions, ModelInfo, StreamEvent } from '../src/provider/types';
import type { IToolExecutor, ToolCall, ToolContext, ToolResult } from '../src/tool/types';
import type { IHttpClient, IHttpResponse } from '@svton/agent-platform';
import { collectEvents, createMockPlatform } from './helpers';

const TEST_MODELS: ModelInfo[] = [{
  id: 'test-model',
  name: 'Test',
  contextWindow: 128000,
  supportsToolUse: true,
  supportsVision: false,
  supportsStreaming: true,
}];

class ExternalAbortProvider implements IProvider {
  readonly name = 'external-abort';
  readonly models = TEST_MODELS;
  observedSignal: AbortSignal | undefined;

  constructor(private readonly externalController: AbortController) {}

  async *chat(_messages: ChatMessage[], options: ChatOptions): AsyncGenerator<StreamEvent> {
    this.observedSignal = options.signal;
    yield { type: 'text_delta', text: 'started' };
    this.externalController.abort();

    if (options.signal?.aborted) {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }

    yield { type: 'text_delta', text: 'not aborted' };
    yield { type: 'done', stopReason: 'stop' };
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  supportsToolUse(): boolean {
    return true;
  }

  supportsVision(): boolean {
    return false;
  }
}

class SignalIgnoringAbortProvider implements IProvider {
  readonly name = 'signal-ignoring-abort';
  readonly models = TEST_MODELS;
  observedSignal: AbortSignal | undefined;

  constructor(private readonly externalController: AbortController) {}

  async *chat(_messages: ChatMessage[], options: ChatOptions): AsyncGenerator<StreamEvent> {
    this.observedSignal = options.signal;
    yield { type: 'text_delta', text: 'before abort' };
    this.externalController.abort();
    yield { type: 'text_delta', text: 'after abort' };
    yield { type: 'done', stopReason: 'stop' };
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  supportsToolUse(): boolean {
    return true;
  }

  supportsVision(): boolean {
    return false;
  }
}

class ToolCallProvider implements IProvider {
  readonly name = 'tool-call';
  readonly models = TEST_MODELS;
  private calls = 0;

  constructor(private readonly toolName = 'long_tool', private readonly argumentsDelta = '{}') {}

  async *chat(_messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<StreamEvent> {
    this.calls += 1;
    if (this.calls === 1) {
      yield { type: 'tool_call_start', id: 'tc_abort', name: this.toolName };
      yield { type: 'tool_call_delta', id: 'tc_abort', argumentsDelta: this.argumentsDelta };
      yield { type: 'tool_call_end', id: 'tc_abort', name: this.toolName, arguments: this.argumentsDelta };
      yield { type: 'done', stopReason: 'tool_use' };
      return;
    }
    yield { type: 'text_delta', text: 'not aborted' };
    yield { type: 'done', stopReason: 'stop' };
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  supportsToolUse(): boolean {
    return true;
  }

  supportsVision(): boolean {
    return false;
  }
}

class AbortBeforeToolExecutionProvider implements IProvider {
  readonly name = 'abort-before-tool-execution';
  readonly models = TEST_MODELS;

  constructor(private readonly externalController: AbortController) {}

  async *chat(_messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<StreamEvent> {
    yield { type: 'tool_call_start', id: 'tc_aborted_before_exec', name: 'side_effect_tool' };
    yield { type: 'tool_call_delta', id: 'tc_aborted_before_exec', argumentsDelta: '{}' };
    yield { type: 'tool_call_end', id: 'tc_aborted_before_exec', name: 'side_effect_tool', arguments: '{}' };
    this.externalController.abort();
    yield { type: 'done', stopReason: 'tool_use' };
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  supportsToolUse(): boolean {
    return true;
  }

  supportsVision(): boolean {
    return false;
  }
}

class TextHttpResponse implements IHttpResponse {
  readonly ok = true;
  readonly status = 200;
  readonly statusText = 'OK';

  constructor(private readonly body: string) {}

  text(): Promise<string> {
    return Promise.resolve(this.body);
  }

  json(): Promise<unknown> {
    return Promise.resolve(JSON.parse(this.body));
  }

  header(name: string): string | null {
    return name.toLowerCase() === 'content-type' ? 'text/plain' : null;
  }
}

describe('E2E abort signal propagation', () => {
  it('propagates external RunOptions.signal aborts into the provider stream', async () => {
    const controller = new AbortController();
    const provider = new ExternalAbortProvider(controller);
    const runtime = AgentRuntime.create({
      provider,
      model: 'test-model',
      toolRegistry: new ToolRegistry(),
    }, createMockPlatform());

    const events = await collectEvents(runtime.run('start streaming', { signal: controller.signal }));
    const text = events.map((event) => event.type === 'text_delta' ? event.text : '').join('');
    const last = events[events.length - 1];

    expect(provider.observedSignal?.aborted).toBe(true);
    expect(text).toBe('started');
    expect(last.type).toBe('done');
    if (last.type === 'done') {
      expect(last.stopReason).toBe('aborted');
    }
  });

  it('stops forwarding provider output after external abort even if provider ignores the signal', async () => {
    const controller = new AbortController();
    const provider = new SignalIgnoringAbortProvider(controller);
    const resumeManager = { checkpoint: vi.fn().mockResolvedValue(undefined) };
    const memoryManager = {
      getAllMemoryText: vi.fn().mockReturnValue(''),
      extractFromConversation: vi.fn().mockResolvedValue([]),
    };
    const runtime = AgentRuntime.create({
      provider,
      model: 'test-model',
      toolRegistry: new ToolRegistry(),
      capabilities: {
        resumeManager: resumeManager as any,
        memoryManager: memoryManager as any,
      },
    }, createMockPlatform());

    const events = await collectEvents(runtime.run('start streaming', { signal: controller.signal }));
    const text = events.map((event) => event.type === 'text_delta' ? event.text : '').join('');
    const last = events[events.length - 1];

    expect(provider.observedSignal?.aborted).toBe(true);
    expect(text).toBe('before abort');
    expect(last.type).toBe('done');
    if (last.type === 'done') {
      expect(last.stopReason).toBe('aborted');
    }
    expect(resumeManager.checkpoint).not.toHaveBeenCalled();
    expect(memoryManager.extractFromConversation).not.toHaveBeenCalled();
  });

  it('propagates external RunOptions.signal aborts into tool execution context', async () => {
    const controller = new AbortController();
    const provider = new ToolCallProvider();
    const registry = new ToolRegistry();
    let observedSignal: AbortSignal | undefined;
    const executor: IToolExecutor = {
      execute: async (call: ToolCall, ctx: ToolContext): Promise<ToolResult> => {
        observedSignal = ctx.signal;
        controller.abort();
        await Promise.resolve();
        return {
          callId: call.id,
          output: ctx.signal?.aborted ? 'tool saw abort' : 'tool missed abort',
        };
      },
    };
    registry.register({
      name: 'long_tool',
      description: 'Long running tool',
      parameters: { type: 'object', properties: {} },
    }, executor);

    const runtime = AgentRuntime.create({
      provider,
      model: 'test-model',
      toolRegistry: registry,
    }, createMockPlatform());

    const events = await collectEvents(runtime.run('run long tool', { signal: controller.signal }));
    const toolEnd = events.find((event) => event.type === 'tool_call_end');
    const last = events[events.length - 1];

    expect(observedSignal?.aborted).toBe(true);
    expect(toolEnd?.type).toBe('tool_call_end');
    if (toolEnd?.type === 'tool_call_end') {
      expect(toolEnd.result.output).toBe('tool saw abort');
    }
    expect(last.type).toBe('done');
    if (last.type === 'done') {
      expect(last.stopReason).toBe('aborted');
    }
  });

  it('does not execute tools after the run signal aborts before tool execution', async () => {
    const controller = new AbortController();
    const provider = new AbortBeforeToolExecutionProvider(controller);
    const registry = new ToolRegistry();
    let executed = false;
    const executor: IToolExecutor = {
      execute: async (call: ToolCall): Promise<ToolResult> => {
        executed = true;
        return { callId: call.id, output: 'side effect happened' };
      },
    };
    registry.register({
      name: 'side_effect_tool',
      description: 'Should not run after abort',
      parameters: { type: 'object', properties: {} },
    }, executor);

    const runtime = AgentRuntime.create({
      provider,
      model: 'test-model',
      toolRegistry: registry,
    }, createMockPlatform());

    const events = await collectEvents(runtime.run('run side effect', { signal: controller.signal }));
    const toolEnd = events.find((event) => event.type === 'tool_call_end');
    const last = events[events.length - 1];

    expect(executed).toBe(false);
    expect(toolEnd?.type).toBe('tool_call_end');
    if (toolEnd?.type === 'tool_call_end') {
      expect(toolEnd.result.isError).toBe(true);
      expect(toolEnd.result.output).toContain('run was aborted');
    }
    expect(last.type).toBe('done');
    if (last.type === 'done') {
      expect(last.stopReason).toBe('aborted');
    }
  });

  it('propagates external RunOptions.signal aborts through web_fetch HTTP requests', async () => {
    const controller = new AbortController();
    const provider = new ToolCallProvider('web_fetch', '{"url":"https://example.test"}');
    const registry = new ToolRegistry();
    let observedSignal: AbortSignal | undefined;
    const http: IHttpClient = {
      request: async (_url, opts) => {
        observedSignal = opts?.signal;
        controller.abort();
        await Promise.resolve();
        return new TextHttpResponse(opts?.signal?.aborted ? 'http saw abort' : 'http missed abort');
      },
    };
    registry.register(webFetchDef, new WebFetchExecutor());

    const runtime = AgentRuntime.create({
      provider,
      model: 'test-model',
      toolRegistry: registry,
    }, createMockPlatform({ http }));

    const events = await collectEvents(runtime.run('fetch page', { signal: controller.signal }));
    const toolEnd = events.find((event) => event.type === 'tool_call_end');
    const last = events[events.length - 1];

    expect(observedSignal?.aborted).toBe(true);
    expect(toolEnd?.type).toBe('tool_call_end');
    if (toolEnd?.type === 'tool_call_end') {
      expect(toolEnd.result.output).toBe('http saw abort');
    }
    expect(last.type).toBe('done');
    if (last.type === 'done') {
      expect(last.stopReason).toBe('aborted');
    }
  });
});
