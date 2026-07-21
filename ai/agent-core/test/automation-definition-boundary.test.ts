import { describe, expect, it } from 'vitest';
import { AutomationManager } from '../src/automation/manager';
import type { IAutomationScheduler } from '../src/automation/scheduler';
import type { AutomationDefinition } from '../src/automation/types';
import { MemoryStorage } from './helpers';

class RecordingScheduler implements IAutomationScheduler {
  schedule(): () => void {
    return () => {};
  }
}

describe('automation definition boundaries', () => {
  it('keeps get() and list() return values from mutating manager-owned definitions', async () => {
    const manager = new AutomationManager(new MemoryStorage(), new RecordingScheduler());
    const definition = await manager.create({
      name: 'Protected interval',
      description: '',
      trigger: { type: 'interval', minutes: 15 },
      prompt: 'Keep the definition stable',
    });

    definition.name = 'Mutated create return';
    const fromGet = manager.get(definition.id);
    if (!fromGet) throw new Error('expected automation definition');
    fromGet.enabled = false;

    const fromList = manager.list()[0];
    fromList.trigger.minutes = 999;

    const fresh = manager.get(definition.id);
    expect(fresh?.name).toBe('Protected interval');
    expect(fresh?.enabled).toBe(true);
    expect(fresh?.trigger.minutes).toBe(15);
  });

  it('keeps create() and update() trigger inputs from mutating manager-owned definitions', async () => {
    const manager = new AutomationManager(new MemoryStorage(), new RecordingScheduler());
    const createTrigger = { type: 'interval' as const, minutes: 15 };
    const definition = await manager.create({
      name: 'Input boundary',
      description: '',
      trigger: createTrigger,
      prompt: 'Clone trigger inputs',
    });

    createTrigger.minutes = 999;
    expect(manager.get(definition.id)?.trigger.minutes).toBe(15);

    const updateTrigger = { type: 'interval' as const, minutes: 30 };
    await manager.update(definition.id, { trigger: updateTrigger });
    updateTrigger.minutes = 777;

    expect(manager.get(definition.id)?.trigger.minutes).toBe(30);
  });

  it('keeps persisted definitions loaded by init() from mutating manager-owned definitions', async () => {
    const storage = new MemoryStorage();
    const persisted: AutomationDefinition = {
      id: 'auto_42_1',
      name: 'Persisted boundary',
      description: '',
      trigger: { type: 'interval', minutes: 20 },
      prompt: 'Clone persisted definitions',
      enabled: false,
      createdAt: 1,
      nextRunAt: 0,
    };
    await storage.set(`agent:automation:${persisted.id}`, persisted);

    const manager = new AutomationManager(storage, new RecordingScheduler());
    await manager.init();

    persisted.name = 'Mutated storage object';
    persisted.trigger.minutes = 888;

    const fresh = manager.get(persisted.id);
    expect(fresh?.name).toBe('Persisted boundary');
    expect(fresh?.trigger.minutes).toBe(20);
  });

  it('keeps storage-held persisted definitions from mutating manager-owned definitions', async () => {
    const storage = new MemoryStorage();
    const manager = new AutomationManager(storage, new RecordingScheduler());
    const definition = await manager.create({
      name: 'Storage boundary',
      description: '',
      trigger: { type: 'interval', minutes: 25 },
      prompt: 'Clone persisted output',
    });

    const persisted = await storage.get<AutomationDefinition>(`agent:automation:${definition.id}`);
    if (!persisted) throw new Error('expected persisted automation definition');

    persisted.name = 'Mutated persisted storage';
    persisted.trigger.minutes = 555;

    const fresh = manager.get(definition.id);
    expect(fresh?.name).toBe('Storage boundary');
    expect(fresh?.trigger.minutes).toBe(25);
  });

  it('passes a definition copy to trigger handlers', async () => {
    const manager = new AutomationManager(new MemoryStorage(), new RecordingScheduler());
    const definition = await manager.create({
      name: 'Handler boundary',
      description: '',
      trigger: { type: 'event', eventType: 'boundary_check' },
      prompt: 'Keep handler mutations local',
    });

    manager.setTriggerHandler(async (automation) => {
      automation.name = 'Mutated by handler';
      automation.trigger.eventType = 'mutated_event';
    });

    await manager.runNow(definition.id);

    const fresh = manager.get(definition.id);
    expect(fresh?.name).toBe('Handler boundary');
    expect(fresh?.trigger.eventType).toBe('boundary_check');
  });
});
