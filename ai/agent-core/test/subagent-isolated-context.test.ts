import { describe, it, expect, vi } from 'vitest';
import { SubagentManager } from '../src/subagent/manager';
import { ToolRegistry } from '../src/tool/registry';
import type { AgentConfig, IRuntime } from '../src/agent/types';
import type { ChatMessage } from '../src/provider/types';
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

function createRuntime(messages: ChatMessage[]): IRuntime {
  return {
    run: vi.fn(async function* () {
      yield { type: 'text_delta', text: 'done' };
      yield {
        type: 'done',
        stopReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      };
    }),
    getMessages: vi.fn(() => messages),
    abort: vi.fn(),
  };
}

describe('SubagentManager isolatedContext', () => {
  it('seeds parent messages into the subagent runtime when isolatedContext is false', async () => {
    const parentMessages: ChatMessage[] = [
      { role: 'user', content: 'Parent question' },
      { role: 'assistant', content: 'Parent answer' },
    ];
    const parentRuntime = createRuntime(parentMessages);
    const toolRegistry = new ToolRegistry();
    const manager = new SubagentManager(
      createConfig(toolRegistry),
      parentRuntime,
      createPlatform(),
      toolRegistry,
    );
    const setMessages = vi.fn();

    (manager as any).createRuntime = () => ({
      ...createRuntime([]),
      setMessages,
    });

    await manager.spawn({
      task: 'Use parent context',
      isolatedContext: false,
    });

    expect(setMessages).toHaveBeenCalledWith(parentMessages);
  });
});
