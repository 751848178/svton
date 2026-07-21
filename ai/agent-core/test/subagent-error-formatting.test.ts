import { describe, expect, it } from 'vitest';
import type { AgentConfig, IRuntime } from '../src/agent/types';
import { SubagentManager } from '../src/subagent/manager';
import { ToolRegistry } from '../src/tool/registry';
import { createMockPlatform } from './helpers';

function createConfig(toolRegistry: ToolRegistry): AgentConfig {
  return {
    provider: {
      name: 'mock',
      models: ['mock-model'],
      chat: async function* () {},
      countTokens: () => 0,
      supportsToolUse: () => true,
      supportsVision: () => false,
    },
    model: 'mock-model',
    toolRegistry,
  };
}

function createManager(): SubagentManager {
  const toolRegistry = new ToolRegistry();
  const manager = new SubagentManager(
    createConfig(toolRegistry),
    {} as IRuntime,
    createMockPlatform(),
    toolRegistry,
  );
  (manager as any).createRuntime = () => ({
    run: async function* () {
      throw { code: 'runtime_down' };
    },
    getMessages: () => [],
  });
  return manager;
}

describe('SubagentManager error formatting', () => {
  it('normalizes non-Error spawn failures', async () => {
    const result = await createManager().spawn({ task: 'do the work' });

    expect(result.success).toBe(false);
    expect(result.summary).toContain('Subagent failed: Unknown error');
    expect(result.summary).not.toContain('[object Object]');
    expect(result.error).toBe('Unknown error');
  });
});
