import { describe, expect, it } from 'vitest';
import type { IStorage } from '@svton/agent-platform';
import { PlanningManager } from '../src/planning/manager';
import type { Plan } from '../src/planning/types';

class ReferenceStorage implements IStorage {
  readonly data = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.data.get(key) as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.data.keys());
    return prefix ? keys.filter((key) => key.startsWith(prefix)) : keys;
  }

  async clear(): Promise<void> {
    this.data.clear();
  }
}

describe('PlanningManager plan ownership boundaries', () => {
  it('returns plan and step copies so callers cannot mutate manager-owned plans', () => {
    const planner = new PlanningManager();
    const created = planner.createPlan('Boundary plan', [
      { title: 'First', description: 'Start' },
      { title: 'Second', description: 'Continue', dependencies: ['step_1'] },
    ]);

    created.title = 'Injected title';
    created.steps[0].status = 'completed';
    created.steps[1].dependencies?.push('injected_dep');

    const fetched = planner.getPlan(created.id);
    expect(fetched?.title).toBe('Boundary plan');
    expect(fetched?.steps[0].status).toBe('pending');
    expect(fetched?.steps[1].dependencies).toEqual(['step_1']);

    fetched!.steps[0].title = 'Injected step';
    const next = planner.getNextStep(created.id);
    expect(next?.title).toBe('First');

    next!.status = 'failed';
    const ready = planner.getReadySteps(created.id);
    ready[0].description = 'Injected ready step';

    expect(planner.getPlan(created.id)?.steps[0]).toMatchObject({
      title: 'First',
      description: 'Start',
      status: 'pending',
    });
  });

  it('separates persisted plan references from manager-owned plans', async () => {
    const storage = new ReferenceStorage();
    const planner = new PlanningManager();
    await planner.init(storage);

    const created = planner.createPlan('Persisted boundary', [
      { title: 'Stored first', description: 'Start' },
    ]);

    const stored = storage.data.get(`plan:${created.id}`) as Plan;
    stored.title = 'Injected persisted title';
    stored.steps[0].status = 'failed';

    expect(planner.getPlan(created.id)).toMatchObject({
      title: 'Persisted boundary',
      steps: [{ status: 'pending' }],
    });

    const persisted: Plan = {
      id: 'plan_999_1',
      title: 'Loaded boundary',
      steps: [{ id: 'step_1', title: 'Load', description: 'Persisted', status: 'pending' }],
      createdAt: 1,
      updatedAt: 1,
    };
    storage.data.set(`plan:${persisted.id}`, persisted);

    const loadedPlanner = new PlanningManager();
    await loadedPlanner.init(storage);
    persisted.title = 'Injected loaded title';
    persisted.steps[0].status = 'completed';

    expect(loadedPlanner.getPlan(persisted.id)).toMatchObject({
      title: 'Loaded boundary',
      steps: [{ status: 'pending' }],
    });
  });
});
