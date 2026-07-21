import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubagentManager } from '../src/subagent/manager';
import { ToolRegistry } from '../src/tool/registry';
import type { AgentConfig } from '../src/agent/types';
import type { IToolExecutor, ToolCall } from '../src/tool/types';
import type { IPlatform } from '@svton/agent-platform';

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

function createPlatform(): IPlatform {
  return {
    type: 'browser',
    capabilities: {
      filesystem: false,
      process: false,
      watch: false,
      mcpStdio: false,
      clipboard: false,
      notification: false,
    },
    fs: {} as any,
    process: {} as any,
    storage: {} as any,
    search: {} as any,
  };
}

function createConfig(toolRegistry: ToolRegistry): AgentConfig {
  return {
    provider: {
      name: 'mock',
      models: [],
      chat: async function* () {},
      countTokens: () => 0,
      supportsToolUse: () => true,
      supportsVision: () => false,
    },
    model: 'test-model',
    toolRegistry,
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
      {} as any,
      createPlatform(),
      toolRegistry,
    );

    (manager as any).createRuntime = () => ({
      run: vi.fn(async function* (_task: string, opts: { signal: AbortSignal }) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        yield {
          type: 'text_delta',
          text: opts.signal.aborted ? 'timeout observed' : 'timeout missing',
        };
        yield {
          type: 'done',
          stopReason: 'stop',
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        };
      }),
      getMessages: vi.fn(() => []),
    });

    const result = await manager.spawn({
      task: 'Inspect timeout-sensitive work',
      timeout: 5,
    });

    expect(result.success).toBe(true);
    expect(result.summary).toBe('timeout observed');
  });
});
