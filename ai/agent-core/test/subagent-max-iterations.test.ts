import { describe, it, expect, vi } from 'vitest';
import { SubagentManager } from '../src/subagent/manager';
import { ToolRegistry } from '../src/tool/registry';
import type { AgentConfig } from '../src/agent/types';
import type { IPlatform } from '@svton/agent-platform';

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

function createConfig(maxIterations?: number): AgentConfig {
  const toolRegistry = new ToolRegistry();
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
    maxIterations,
  };
}

function createRuntimeSpy(manager: SubagentManager, configs: AgentConfig[]): void {
  (manager as any).createRuntime = (config: AgentConfig) => {
    configs.push(config);
    return {
      run: vi.fn(async function* () {
        yield { type: 'text_delta', text: 'done' };
        yield {
          type: 'done',
          stopReason: 'stop',
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        };
      }),
      getMessages: vi.fn(() => []),
    };
  };
}

describe('SubagentManager maxIterations propagation', () => {
  it('inherits parent maxIterations when the subagent does not override it', async () => {
    const parentConfig = createConfig(3);
    const manager = new SubagentManager(
      parentConfig,
      {} as any,
      createPlatform(),
      parentConfig.toolRegistry,
    );
    const configs: AgentConfig[] = [];
    createRuntimeSpy(manager, configs);

    await manager.spawn({ task: 'Inherit iteration cap' });

    expect(configs[0].maxIterations).toBe(3);
  });

  it('preserves an explicit maxIterations value of 0', async () => {
    const parentConfig = createConfig(5);
    const manager = new SubagentManager(
      parentConfig,
      {} as any,
      createPlatform(),
      parentConfig.toolRegistry,
    );
    const configs: AgentConfig[] = [];
    createRuntimeSpy(manager, configs);

    await manager.spawn({ task: 'Do not run model loop', maxIterations: 0 });

    expect(configs[0].maxIterations).toBe(0);
  });
});
