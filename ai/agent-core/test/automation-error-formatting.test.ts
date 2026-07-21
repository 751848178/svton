import { describe, expect, it } from 'vitest';
import { AutomationManager } from '../src/automation/manager';
import { CreateAutomationExecutor } from '../src/automation/create-tool';
import type { IAutomationScheduler } from '../src/automation/scheduler';
import type { IStorage } from '@svton/agent-platform';

class MemoryStorage implements IStorage {
  private readonly map = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.map.get(key) as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.map.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.map.keys());
    return prefix ? keys.filter((key) => key.startsWith(prefix)) : keys;
  }

  async clear(): Promise<void> {
    this.map.clear();
  }
}

class ManualScheduler implements IAutomationScheduler {
  schedule(): () => void {
    return () => {};
  }
}

describe('automation error formatting', () => {
  it('normalizes non-Error create_automation tool failures', async () => {
    class ThrowingCreateManager extends AutomationManager {
      override async create(): Promise<never> {
        throw { code: 'persist_failed' };
      }
    }

    const executor = new CreateAutomationExecutor(
      new ThrowingCreateManager(new MemoryStorage(), new ManualScheduler()),
    );

    const result = await executor.execute(
      {
        id: 'call-1',
        name: 'create_automation',
        arguments: {
          name: 'Daily check',
          schedule: 'every 30 minutes',
          prompt: 'Check the repo',
        },
      },
      {} as never,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Failed to create automation: Unknown error');
    expect(result.output).not.toContain('[object Object]');
  });

  it('normalizes non-Error runNow failures in run history', async () => {
    const manager = new AutomationManager(new MemoryStorage(), new ManualScheduler());
    manager.setTriggerHandler(async () => {
      throw { code: 'handler_failed' };
    });

    const definition = await manager.create({
      name: 'Object failure',
      description: '',
      trigger: { type: 'event' },
      prompt: 'Run failing handler',
    });

    await manager.runNow(definition.id);

    const runs = await manager.getRuns(definition.id);
    expect(runs).toEqual([
      expect.objectContaining({
        status: 'failed',
        error: 'Unknown error',
      }),
    ]);
    expect(runs[0].error).not.toContain('[object Object]');
  });
});
