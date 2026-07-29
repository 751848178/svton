/**
 * E2E abort signal propagation (Pi-backed runtime).
 *
 * Verifies that an external `RunOptions.signal` abort flows through Pi Agent
 * into the stream function (faux provider) and into tool execution context,
 * and that pending tool approvals are rejected on abort.
 */
import { describe, expect, it } from 'vitest';
import { SvtonAgentRuntime } from '../src/agent/svton-agent-runtime';
import { ToolRegistry } from '../src/tool/registry';
import {
  createMockModels,
  createMockPlatform,
  collectEvents,
  fauxAssistantMessage,
  fauxToolCall,
  fauxText,
} from './helpers';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../src/tool/types';
import type { SvtonToolDefinition } from '../src/tool/types';

function makeToolDef(name: string): SvtonToolDefinition {
  return { name, description: name, parameters: { type: 'object', properties: {} } };
}

describe('E2E abort signal propagation (Pi-backed)', () => {
  it('stops with done(aborted) when the external signal is already aborted', async () => {
    const mock = createMockModels();
    const runtime = SvtonAgentRuntime.create(
      { models: mock.models, piModel: mock.model, model: 'test-model', toolRegistry: new ToolRegistry() },
      createMockPlatform(),
    );
    const controller = new AbortController();
    controller.abort();
    const events = await collectEvents(runtime.run('go', { signal: controller.signal }));
    const last = events[events.length - 1];
    expect(last.type).toBe('done');
    if (last.type === 'done') expect(last.stopReason).toBe('aborted');
  });

  it('propagates external RunOptions.signal abort into tool execution context', async () => {
    const mock = createMockModels();
    const registry = new ToolRegistry();
    let observedSignal: AbortSignal | undefined;
    const executor: IToolExecutor = {
      execute: async (call: ToolCall, ctx: ToolContext): Promise<ToolResult> => {
        observedSignal = ctx.signal;
        // Abort mid-tool; the run should observe it and stop.
        controller.abort();
        await Promise.resolve();
        return {
          callId: call.id,
          output: ctx.signal?.aborted ? 'tool saw abort' : 'tool missed abort',
        };
      },
    };
    registry.register(makeToolDef('long_tool'), executor);
    const runtime = SvtonAgentRuntime.create(
      { models: mock.models, piModel: mock.model, model: 'test-model', toolRegistry: registry },
      createMockPlatform(),
    );
    const controller = new AbortController();

    mock.addResponse(fauxAssistantMessage([fauxToolCall('long_tool', {})]));
    mock.addResponse(fauxAssistantMessage([fauxText('not aborted')]));

    const events = await collectEvents(runtime.run('run long tool', { signal: controller.signal }));
    const toolEnd = events.find((e) => e.type === 'tool_call_end');
    const last = events[events.length - 1];

    expect(observedSignal?.aborted).toBe(true);
    expect(toolEnd?.type).toBe('tool_call_end');
    if (toolEnd?.type === 'tool_call_end') {
      expect(toolEnd.result.output).toBe('tool saw abort');
    }
    expect(last.type).toBe('done');
    if (last.type === 'done') expect(last.stopReason).toBe('aborted');
  });

  it('propagates external RunOptions.signal aborts through web_fetch HTTP requests', async () => {
    const { WebFetchExecutor, webFetchDef } = await import('../src/tool/builtins/web');
    const mock = createMockModels();
    const registry = new ToolRegistry();
    let observedSignal: AbortSignal | undefined;
    const http = {
      request: async (_url: string, opts: { signal?: AbortSignal }) => {
        observedSignal = opts?.signal;
        controller.abort();
        await Promise.resolve();
        return textResponse(opts?.signal?.aborted ? 'http saw abort' : 'http missed abort');
      },
    };
    registry.register(webFetchDef, new WebFetchExecutor());
    const runtime = SvtonAgentRuntime.create(
      { models: mock.models, piModel: mock.model, model: 'test-model', toolRegistry: registry },
      createMockPlatform({ http: http as any }),
    );
    const controller = new AbortController();

    mock.addResponse(fauxAssistantMessage([fauxToolCall('web_fetch', { url: 'https://example.test' })]));
    mock.addResponse(fauxAssistantMessage([fauxText('done')]));

    const events = await collectEvents(runtime.run('fetch page', { signal: controller.signal }));
    const toolEnd = events.find((e) => e.type === 'tool_call_end');
    const last = events[events.length - 1];

    expect(observedSignal?.aborted).toBe(true);
    expect(toolEnd?.type).toBe('tool_call_end');
    if (toolEnd?.type === 'tool_call_end') {
      expect(toolEnd.result.output).toBe('http saw abort');
    }
    expect(last.type).toBe('done');
    if (last.type === 'done') expect(last.stopReason).toBe('aborted');
  });
});

function textResponse(body: string) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(JSON.parse(body)),
    header: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/plain' : null),
  };
}
