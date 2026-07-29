import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubagentManager } from '../src/subagent/manager';
import { ToolRegistry } from '../src/tool/registry';
import type { AgentConfig, IRuntime } from '../src/agent/types';
import type { IToolExecutor, ToolCall } from '../src/tool/types';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import {
  createMockModels,
  createMockPlatform,
  fauxAssistantMessage,
  fauxText,
  nativeAssistantLifecycle,
} from './helpers';

function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  const executor: IToolExecutor = {
    execute: async (call: ToolCall) => ({ callId: call.id, output: 'ok' }),
  };
  registry.register(
    {
      name: 'file_read',
      description: 'Tool: file_read',
      parameters: { type: 'object', properties: {} },
    },
    executor,
  );
  return registry;
}

function createConfig(toolRegistry: ToolRegistry): AgentConfig {
  const mock = createMockModels();
  return {
    models: mock.models,
    piModel: mock.model,
    model: 'test-model',
    toolRegistry,
  };
}

function createParentRuntime(): IRuntime {
  return {
    async *run() {},
    getMessages: () => [],
    reset: () => {},
    abort: () => {},
  };
}

describe('SubagentManager timeout propagation', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('passes SubagentConfig.timeout to the runtime abort signal', async () => {
    const toolRegistry = createToolRegistry();
    const manager = new SubagentManager(
      createConfig(toolRegistry),
      createParentRuntime(),
      createMockPlatform({ capabilities: { filesystem: false, process: false } }),
      toolRegistry,
    );

    let messages: AgentMessage[] = [];
    const runtime: IRuntime = {
      run: vi.fn(async function* (_task, opts) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        const text = opts?.signal?.aborted ? 'timeout observed' : 'timeout missing';
        messages = [fauxAssistantMessage([fauxText(text)])];
        for (const event of nativeAssistantLifecycle({ content: text })) yield event;
      }),
      getMessages: vi.fn(() => messages),
      reset: vi.fn(),
      abort: vi.fn(),
    };
    Object.defineProperty(manager, 'createRuntime', { value: () => runtime });

    const result = await manager.spawn({
      task: 'Inspect timeout-sensitive work',
      timeout: 5,
    });

    expect(result.success).toBe(true);
    expect(result.summary).toBe('timeout observed');
  });
});
