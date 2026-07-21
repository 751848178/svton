import { describe, it, expect } from 'vitest';
import {
  ContextManager,
  HookManager,
  PermissionManager,
  ToolRegistry,
} from '@svton/agent-core';
import { ToolExecutionService } from '../src/agent/tool-executor';
import type {
  IToolExecutor,
  ToolCall,
  ToolContext,
  ToolDefinition,
  ToolResult,
} from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';

function createMockPlatform(): IPlatform {
  return {
    type: 'tauri',
    capabilities: {
      filesystem: true,
      process: true,
      watch: false,
      mcpStdio: false,
      clipboard: false,
      notification: false,
      sandboxing: false,
      pty: false,
      documentPreview: false,
      computerUse: false,
    },
    fs: {} as any,
    process: {} as any,
    storage: {} as any,
    search: {} as any,
  };
}

function createRecordingExecutor(): IToolExecutor & { calls: ToolCall[] } {
  const calls: ToolCall[] = [];
  return {
    calls,
    execute: async (call: ToolCall, _ctx: ToolContext): Promise<ToolResult> => {
      calls.push(call);
      return { callId: call.id, output: 'tool ran' };
    },
  };
}

function makeToolDef(name: string): ToolDefinition {
  return {
    name,
    description: `Tool ${name}`,
    parameters: { type: 'object', properties: {} },
  };
}

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of gen) items.push(item);
  return items;
}

describe('tool hook context boundaries', () => {
  it('ignores direct hook context mutation unless the hook returns modify', async () => {
    const toolRegistry = new ToolRegistry();
    const exec = createRecordingExecutor();
    toolRegistry.register(makeToolDef('file_read'), exec);

    const hookManager = new HookManager();
    hookManager.register({
      event: 'pre_tool_use',
      handler: async (ctx) => {
        const call = ctx.toolCall as ToolCall;
        call.arguments.path = 'mutated-without-modify.txt';
        return { action: 'continue' };
      },
    });

    const service = new ToolExecutionService(
      toolRegistry,
      new ContextManager(),
      createMockPlatform(),
      '/project',
      new PermissionManager({ mode: 'default' }),
      hookManager,
      new Map(),
    );
    service.setExecOptions({ sessionId: 'test-session' });

    await drain(service.execute({
      id: 'call-file-read',
      name: 'file_read',
      arguments: { path: 'original.txt' },
    }));

    expect(exec.calls).toHaveLength(1);
    expect(exec.calls[0].arguments).toEqual({ path: 'original.txt' });
  });
});
