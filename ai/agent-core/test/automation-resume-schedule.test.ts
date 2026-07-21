import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('automation resume scheduling', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('recomputes nextRunAt from resume time for paused interval automations', async () => {
    const start = Date.parse('2026-01-01T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(start);

    const scheduler = new RecordingScheduler();
    const manager = new AutomationManager(new MemoryStorage(), scheduler);
    const definition = await manager.create({
      name: 'Paused interval',
      description: '',
      trigger: { type: 'interval', minutes: 30 },
      prompt: 'Run later',
      enabled: false,
    });

    vi.setSystemTime(start + 2 * 60 * 60_000);
    await manager.resume(definition.id);

    const expectedNextRunAt = start + 2 * 60 * 60_000 + 30 * 60_000;
    expect(scheduler.scheduleCalls).toEqual([expectedNextRunAt]);
    expect(manager.get(definition.id)?.nextRunAt).toBe(expectedNextRunAt);
  });
});
