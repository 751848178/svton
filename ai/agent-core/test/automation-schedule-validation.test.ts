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

class RecordingScheduler implements IAutomationScheduler {
  readonly scheduleCalls: number[] = [];

  schedule(nextRunAt: number): () => void {
    this.scheduleCalls.push(nextRunAt);
    return () => {};
  }
}

describe('automation schedule validation', () => {
  it('rejects invalid cron expressions before persisting or scheduling', async () => {
    const storage = new MemoryStorage();
    const scheduler = new RecordingScheduler();
    const manager = new AutomationManager(storage, scheduler);

    await expect(manager.create({
      name: 'Bad cron',
      description: '',
      trigger: { type: 'cron', expression: '99 99 99 99 99' },
      prompt: 'This should not be created',
    })).rejects.toThrow('Invalid cron expression');

    expect(manager.list()).toHaveLength(0);
    expect(await storage.list('agent:automation:')).toHaveLength(0);
    expect(scheduler.scheduleCalls).toHaveLength(0);
  });

  it('reports invalid natural-language cron schedules through create_automation', async () => {
    const manager = new AutomationManager(new MemoryStorage(), new RecordingScheduler());
    const executor = new CreateAutomationExecutor(manager);

    const result = await executor.execute(
      {
        id: 'call-1',
        name: 'create_automation',
        arguments: {
          name: 'Impossible daily task',
          schedule: 'every day at 25:00',
          prompt: 'Run impossible schedule',
        },
      },
      {} as never,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Failed to create automation: Invalid cron expression');
    expect(result.output).not.toContain('created successfully');
    expect(manager.list()).toHaveLength(0);
  });

  it('rejects cron expressions with no future run', async () => {
    const storage = new MemoryStorage();
    const scheduler = new RecordingScheduler();
    const manager = new AutomationManager(storage, scheduler);

    await expect(manager.create({
      name: 'Impossible date',
      description: '',
      trigger: { type: 'cron', expression: '0 0 31 2 *' },
      prompt: 'This should never be scheduled',
    })).rejects.toThrow('Invalid cron expression');

    expect(manager.list()).toHaveLength(0);
    expect(scheduler.scheduleCalls).toHaveLength(0);
  });

  it('rejects unknown weekdays in natural-language weekly schedules', async () => {
    const manager = new AutomationManager(new MemoryStorage(), new RecordingScheduler());
    const executor = new CreateAutomationExecutor(manager);

    const result = await executor.execute(
      {
        id: 'call-2',
        name: 'create_automation',
        arguments: {
          name: 'Invalid weekday task',
          schedule: 'weekly on funday at 10:00',
          prompt: 'Run impossible weekday',
        },
      },
      {} as never,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Failed to create automation: Invalid weekday');
    expect(manager.list()).toHaveLength(0);
  });

  it('keeps valid weekly weekdays mapped to the requested day', () => {
    expect(AutomationManager.parseSchedule('weekly on monday at 10:00')).toEqual({
      type: 'cron',
      expression: '0 10 * * 1',
    });
  });

  it('honors weekly schedule pm suffixes', () => {
    expect(AutomationManager.parseSchedule('weekly on monday at 10pm')).toEqual({
      type: 'cron',
      expression: '0 22 * * 1',
    });
  });

  it('honors weekly schedule 12am as midnight', () => {
    expect(AutomationManager.parseSchedule('weekly on monday at 12am')).toEqual({
      type: 'cron',
      expression: '0 0 * * 1',
    });
  });
});
