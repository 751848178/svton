import { describe, it, expect } from 'vitest';
import { SubagentManager } from '../src/subagent/manager';
import { ToolRegistry } from '../src/tool/registry';
import type { AgentConfig } from '../src/agent/types';
import type { IPlatform } from '@svton/agent-platform';

function createToolRegistry(): ToolRegistry {
  return new ToolRegistry();
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

function createManager(): SubagentManager {
  const toolRegistry = createToolRegistry();
  return new SubagentManager(
    createConfig(toolRegistry),
    {} as any,
    createPlatform(),
    toolRegistry,
  );
}

describe('SubagentManager.spawnOnCsv concurrency validation', () => {
  it.each([
    ['fractional', 1.5],
    ['zero', 0],
    ['not finite', Number.NaN],
  ])('rejects %s concurrency for direct manager calls', async (_label, concurrency) => {
    await expect(
      createManager().spawnOnCsv({
        csvContent: 'name\nAlice\nBob',
        taskTemplate: 'Research {{name}}',
        concurrency,
      }),
    ).rejects.toThrow('"concurrency" must be a positive integer');
  });
});
