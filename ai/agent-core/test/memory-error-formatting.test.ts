import { describe, expect, it, vi } from 'vitest';
import { MemoryRecallExecutor, MemorySaveExecutor } from '../src/tool/builtins/memory';
import type { ToolCall, ToolContext } from '../src/tool/types';
import { createMockPlatform } from './helpers';

function makeCall(name: string, args: Record<string, unknown>): ToolCall {
  return { id: name, name, arguments: args };
}

function makeContext(): ToolContext {
  return {
    platform: createMockPlatform(),
    sessionId: 'session',
    workingDir: '/',
  };
}

describe('memory tool error formatting', () => {
  it('normalizes non-Error memory_save failures', async () => {
    const manager = {
      saveAutoMemory: vi.fn(async () => {
        throw { code: 'save_down' };
      }),
    };

    const result = await new MemorySaveExecutor(manager as any).execute(
      makeCall('memory_save', { content: 'remember this', category: 'notes' }),
      makeContext(),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Failed to save memory: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      category: 'notes',
      contentLength: 13,
    });
    expect(manager.saveAutoMemory).toHaveBeenCalledWith('remember this', 'notes');
  });

  it('normalizes non-Error memory_recall failures', async () => {
    const manager = {
      getAllMemoryText: vi.fn(() => {
        throw { code: 'recall_down' };
      }),
    };

    const result = await new MemoryRecallExecutor(manager as any).execute(
      makeCall('memory_recall', { query: 'notes' }),
      makeContext(),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Failed to recall memory: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      filterName: 'query',
      keyword: 'notes',
    });
  });
});
