import { describe, expect, it, vi } from 'vitest';
import { CreateAutomationExecutor } from '../src/automation/create-tool';
import { AutomationManager } from '../src/automation/manager';
import type { IAutomationScheduler } from '../src/automation/scheduler';
import { MemoryStorage } from './helpers';

class RecordingScheduler implements IAutomationScheduler {
  readonly scheduleCalls: number[] = [];

  schedule(nextRunAt: number): () => void {
    this.scheduleCalls.push(nextRunAt);
    return () => {};
  }
}

describe('automation event trigger schedules', () => {
  it('matches documented "on <event>" schedules when the platform event fires', async () => {
    const scheduler = new RecordingScheduler();
    const manager = new AutomationManager(new MemoryStorage(), scheduler);
    const executor = new CreateAutomationExecutor(manager);
    const onTrigger = vi.fn(async () => {});
    manager.setTriggerHandler(onTrigger);

    const result = await executor.execute(
      {
        id: 'call-1',
        name: 'create_automation',
        arguments: {
          name: 'Git commit hook',
          schedule: 'on git_commit',
          prompt: 'Review the commit',
        },
      },
      {} as never,
    );

    expect(result.isError).not.toBe(true);
    expect(manager.get(manager.list()[0].id)?.trigger.eventType).toBe('git_commit');

    await manager.triggerEvent('git_commit');

    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(scheduler.scheduleCalls).toHaveLength(0);
  });
});
