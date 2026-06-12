import { describe, it, expect, vi } from 'vitest';
import { SubagentSpawnExecutor, subagentSpawnDef } from '../src/tool/subagent-spawn';
import type { SubagentManager } from '@svton/agent-core';

// ==============================================================
// Mock SubagentManager
// ==============================================================

function createMockManager(overrides?: Partial<{ spawn: any }>): SubagentManager {
  return {
    spawn: vi.fn().mockResolvedValue({ success: true, summary: 'Task completed' }),
    ...overrides,
  } as any;
}

// ==============================================================
// Tests
// ==============================================================

describe('SubagentSpawnExecutor', () => {
  // ----------------------------------------------------------
  // 1. Input validation
  // ----------------------------------------------------------
  describe('input validation', () => {
    it('returns error when task is missing', async () => {
      const executor = new SubagentSpawnExecutor(createMockManager());
      const result = await executor.execute({
        id: 'tc1', name: 'subagent_spawn', arguments: {},
      } as any);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('"task" is required');
    });

    it('returns error when task is not a string', async () => {
      const executor = new SubagentSpawnExecutor(createMockManager());
      const result = await executor.execute({
        id: 'tc1', name: 'subagent_spawn', arguments: { task: 123 },
      } as any);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('"task" is required');
    });

    it('returns error when task is empty string', async () => {
      const executor = new SubagentSpawnExecutor(createMockManager());
      const result = await executor.execute({
        id: 'tc1', name: 'subagent_spawn', arguments: { task: '' },
      } as any);
      expect(result.isError).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 2. Manager availability
  // ----------------------------------------------------------
  describe('manager availability', () => {
    it('returns error when manager is null', async () => {
      const executor = new SubagentSpawnExecutor(null as any);
      const result = await executor.execute({
        id: 'tc1', name: 'subagent_spawn', arguments: { task: 'Do something' },
      } as any);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('SubagentManager not available');
    });
  });

  // ----------------------------------------------------------
  // 3. Successful spawn
  // ----------------------------------------------------------
  describe('successful spawn', () => {
    it('returns success summary from manager', async () => {
      const manager = createMockManager();
      const executor = new SubagentSpawnExecutor(manager);
      const result = await executor.execute({
        id: 'tc1', name: 'subagent_spawn', arguments: { task: 'Write tests' },
      } as any);
      expect(result.isError).toBe(false);
      expect(result.output).toBe('Task completed');
      expect(result.callId).toBe('tc1');
    });

    it('passes roleDescription to spawn', async () => {
      const manager = createMockManager();
      const executor = new SubagentSpawnExecutor(manager);
      await executor.execute({
        id: 'tc1', name: 'subagent_spawn',
        arguments: { task: 'Review code', roleDescription: 'a code reviewer' },
      } as any);
      expect(manager.spawn).toHaveBeenCalledWith({
        task: 'Review code',
        roleDescription: 'a code reviewer',
      });
    });
  });

  // ----------------------------------------------------------
  // 4. Failed spawn
  // ----------------------------------------------------------
  describe('failed spawn', () => {
    it('returns error when spawn returns failure', async () => {
      const manager = createMockManager({
        spawn: vi.fn().mockResolvedValue({ success: false, error: 'Timeout' }),
      });
      const executor = new SubagentSpawnExecutor(manager);
      const result = await executor.execute({
        id: 'tc1', name: 'subagent_spawn', arguments: { task: 'Do it' },
      } as any);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Subagent failed');
      expect(result.output).toContain('Timeout');
    });

    it('handles unknown error from spawn', async () => {
      const manager = createMockManager({
        spawn: vi.fn().mockResolvedValue({ success: false, error: undefined }),
      });
      const executor = new SubagentSpawnExecutor(manager);
      const result = await executor.execute({
        id: 'tc1', name: 'subagent_spawn', arguments: { task: 'Do it' },
      } as any);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('unknown error');
    });
  });

  // ----------------------------------------------------------
  // 5. Exception handling
  // ----------------------------------------------------------
  describe('exception handling', () => {
    it('catches exceptions from spawn and wraps in error result', async () => {
      const manager = createMockManager({
        spawn: vi.fn().mockRejectedValue(new Error('Network failure')),
      });
      const executor = new SubagentSpawnExecutor(manager);
      const result = await executor.execute({
        id: 'tc1', name: 'subagent_spawn', arguments: { task: 'Do it' },
      } as any);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Subagent error');
      expect(result.output).toContain('Network failure');
    });

    it('handles non-Error exceptions', async () => {
      const manager = createMockManager({
        spawn: vi.fn().mockRejectedValue('string error'),
      });
      const executor = new SubagentSpawnExecutor(manager);
      const result = await executor.execute({
        id: 'tc1', name: 'subagent_spawn', arguments: { task: 'Do it' },
      } as any);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('string error');
    });
  });
});

// ==============================================================
// Tool definition
// ==============================================================

describe('subagentSpawnDef', () => {
  it('has correct name', () => {
    expect(subagentSpawnDef.name).toBe('subagent_spawn');
  });

  it('requires task parameter', () => {
    expect(subagentSpawnDef.parameters.required).toContain('task');
  });

  it('has task and roleDescription in properties', () => {
    expect(subagentSpawnDef.parameters.properties.task).toBeDefined();
    expect(subagentSpawnDef.parameters.properties.roleDescription).toBeDefined();
  });
});
