import { describe, expect, it, vi } from 'vitest';
import { AutomationManager } from '../src/automation/manager';
import type { IAutomationScheduler } from '../src/automation/scheduler';
import type { AutomationRun } from '../src/automation/types';
import { MemoryStorage } from './helpers';

class RecordingScheduler implements IAutomationScheduler {
  schedule(): () => void {
    return () => {};
  }
}

describe('automation run history', () => {
  it('returns a run-history array copy so callers cannot mutate stored history', async () => {
    const manager = new AutomationManager(new MemoryStorage(), new RecordingScheduler());
    manager.setTriggerHandler(vi.fn(async () => {}));
    const definition = await manager.create({
      name: 'History owner',
      description: '',
      trigger: { type: 'event' },
      prompt: 'Record history',
    });

    await manager.runNow(definition.id);

    const runs = await manager.getRuns(definition.id);
    runs.push({
      id: 'injected',
      automationId: definition.id,
      startedAt: 1,
      status: 'failed',
      sessionId: '',
    } satisfies AutomationRun);

    const freshRuns = await manager.getRuns(definition.id);
    expect(freshRuns).toHaveLength(1);
    expect(freshRuns[0].id).not.toBe('injected');
  });

  it('returns run-history entry copies so callers cannot mutate stored runs', async () => {
    const manager = new AutomationManager(new MemoryStorage(), new RecordingScheduler());
    manager.setTriggerHandler(vi.fn(async () => {}));
    const definition = await manager.create({
      name: 'Run entry owner',
      description: '',
      trigger: { type: 'event' },
      prompt: 'Record immutable entries',
    });

    await manager.runNow(definition.id);

    const runs = await manager.getRuns(definition.id);
    runs[0].status = 'failed';
    runs[0].error = 'injected failure';

    const freshRuns = await manager.getRuns(definition.id);
    expect(freshRuns[0].status).toBe('completed');
    expect(freshRuns[0].error).toBeUndefined();
  });
});
