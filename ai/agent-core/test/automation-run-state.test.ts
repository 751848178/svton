import { describe, expect, it } from 'vitest';
import { AutomationManager } from '../src/automation/manager';
import type { IAutomationScheduler } from '../src/automation/scheduler';
import type { AutomationDefinition } from '../src/automation/types';
import { MemoryStorage } from './helpers';

class RecordingScheduler implements IAutomationScheduler {
  readonly scheduleCalls: number[] = [];

  schedule(nextRunAt: number): () => void {
    this.scheduleCalls.push(nextRunAt);
    return () => {};
  }
}

describe('automation run state changes', () => {
  it('does not reschedule stale enabled state after a handler pauses the automation', async () => {
    const storage = new MemoryStorage();
    const scheduler = new RecordingScheduler();
    const manager = new AutomationManager(storage, scheduler);
    const definition = await manager.create({
      name: 'Self-pausing interval',
      description: '',
      trigger: { type: 'interval', minutes: 15 },
      prompt: 'Pause after running',
    });

    manager.setTriggerHandler(async () => {
      await manager.pause(definition.id);
    });

    await manager.runNow(definition.id);

    const stored = await storage.get<AutomationDefinition>(`agent:automation:${definition.id}`);
    expect(scheduler.scheduleCalls).toHaveLength(1);
    expect(manager.get(definition.id)?.enabled).toBe(false);
    expect(stored?.enabled).toBe(false);
  });

  it('does not repersist deleted automations after a handler deletes them', async () => {
    const storage = new MemoryStorage();
    const scheduler = new RecordingScheduler();
    const manager = new AutomationManager(storage, scheduler);
    const definition = await manager.create({
      name: 'Self-deleting interval',
      description: '',
      trigger: { type: 'interval', minutes: 15 },
      prompt: 'Delete after running',
    });

    manager.setTriggerHandler(async () => {
      await manager.delete(definition.id);
    });

    await manager.runNow(definition.id);

    const stored = await storage.get<AutomationDefinition>(`agent:automation:${definition.id}`);
    expect(scheduler.scheduleCalls).toHaveLength(1);
    expect(manager.get(definition.id)).toBeNull();
    expect(stored).toBeNull();
  });
});
