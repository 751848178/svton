import { describe, it, expect, vi } from 'vitest';
import {
  SubagentManager,
  ToolRegistry,
} from '@svton/agent-core';
import type {
  AgentConfig,
  IRuntime,
  IToolExecutor,
  SubagentConfig,
  SubagentResult,
  ToolCall,
} from '@svton/agent-core';
import { createMockModels, createMockPlatform } from './helpers';

function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  const executor: IToolExecutor = {
    execute: async (call: ToolCall) => ({ callId: call.id, output: 'ok' }),
  };
  registry.register(
    {
      name: 'bash',
      description: 'Tool: bash',
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

describe('csv_fanout blank records', () => {
  it('does not spawn a subagent for blank CSV records between data rows', async () => {
    const toolRegistry = createToolRegistry();
    const manager = new SubagentManager(
      createConfig(toolRegistry),
      createParentRuntime(),
      createMockPlatform(),
      toolRegistry,
    );
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
      csvContent: 'name,company\nAlice,Acme\n\n  \nBob,Globex',
      taskTemplate: 'Research {{name}} at {{company}}',
    });

    expect(results).toHaveLength(2);
    expect(spawnedTasks).toEqual([
      'Research Alice at Acme',
      'Research Bob at Globex',
    ]);
  });
});
