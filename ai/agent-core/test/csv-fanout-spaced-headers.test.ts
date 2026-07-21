import { describe, expect, it, vi } from 'vitest';
import { SubagentManager } from '../src/subagent/manager';
import { ToolRegistry } from '../src/tool/registry';
import type { AgentConfig } from '../src/agent/types';
import type { SubagentConfig, SubagentResult } from '../src/subagent/types';
import type { IPlatform } from '@svton/agent-platform';

function createManager(): SubagentManager {
  const toolRegistry = new ToolRegistry();
  const config: AgentConfig = {
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
  const platform: IPlatform = {
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

  return new SubagentManager(config, {} as any, platform, toolRegistry);
}

describe('csv_fanout spaced headers', () => {
  it('fills placeholders whose CSV header names contain spaces', async () => {
    const manager = createManager();
    const spawnedTasks: string[] = [];

    vi.spyOn(manager, 'spawn').mockImplementation(
      async (config: SubagentConfig): Promise<SubagentResult> => {
        spawnedTasks.push(config.task);
        return {
          agentId: 'subagent',
          summary: config.task,
          messages: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          success: true,
        };
      },
    );

    const { results } = await manager.spawnOnCsv({
      csvContent: '"Full Name",Company\n"Alice Chen",Acme',
      taskTemplate: 'Research {{Full Name}} at {{Company}}',
    });

    expect(results).toHaveLength(1);
    expect(spawnedTasks).toEqual(['Research Alice Chen at Acme']);
  });
});
