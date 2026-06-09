import { describe, it, expect, beforeEach } from 'vitest';
import { PlanningManager } from '@svton/agent-core';
import type { Plan, PlanStep, PlanStepStatus } from '@svton/agent-core';
import type { IStorage } from '@svton/agent-platform';

// ============================================================
// Mock Storage
// ============================================================

class MockStorage implements IStorage {
  private data = new Map<string, unknown>();

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
    return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
  }

  async clear(): Promise<void> {
    this.data.clear();
  }
}

// ============================================================
// PlanningManager Tests
// ============================================================

describe('PlanningManager', () => {
  let planner: PlanningManager;
  let storage: MockStorage;

  beforeEach(() => {
    planner = new PlanningManager();
    storage = new MockStorage();
  });

  it('createPlan creates plan with steps, all pending', () => {
    const plan = planner.createPlan('Build feature X', [
      { title: 'Step 1', description: 'Design the API' },
      { title: 'Step 2', description: 'Implement endpoint' },
      { title: 'Step 3', description: 'Write tests' },
    ]);

    expect(plan.title).toBe('Build feature X');
    expect(plan.steps).toHaveLength(3);
    expect(plan.id).toMatch(/^plan_/);
    expect(plan.createdAt).toBeGreaterThan(0);
    expect(plan.updatedAt).toBeGreaterThan(0);

    // All steps should be pending
    for (const step of plan.steps) {
      expect(step.status).toBe('pending');
    }

    expect(plan.steps[0].id).toBe('step_1');
    expect(plan.steps[1].id).toBe('step_2');
    expect(plan.steps[2].id).toBe('step_3');
  });

  it('createPlan assigns unique IDs', () => {
    const plan1 = planner.createPlan('Plan A', [
      { title: 'Do A', description: 'Task A' },
    ]);
    const plan2 = planner.createPlan('Plan B', [
      { title: 'Do B', description: 'Task B' },
    ]);

    expect(plan1.id).not.toBe(plan2.id);
  });

  it('getPlan retrieves plan by ID', () => {
    const plan = planner.createPlan('My Plan', [
      { title: 'Task', description: 'Do it' },
    ]);

    const retrieved = planner.getPlan(plan.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(plan.id);
    expect(retrieved!.title).toBe('My Plan');
  });

  it('getPlan returns null for unknown ID', () => {
    expect(planner.getPlan('nonexistent')).toBeNull();
  });

  it('updateStepStatus changes step status', () => {
    const plan = planner.createPlan('Plan', [
      { title: 'A', description: 'First' },
      { title: 'B', description: 'Second' },
    ]);

    const result = planner.updateStepStatus(plan.id, 'step_1', 'completed');

    expect(result).toBe(true);
    expect(plan.steps[0].status).toBe('completed');
    expect(plan.steps[1].status).toBe('pending');

    // updatedAt should change
    expect(plan.updatedAt).toBeGreaterThanOrEqual(plan.createdAt);
  });

  it('updateStepStatus stores result', () => {
    const plan = planner.createPlan('Plan', [
      { title: 'A', description: 'First' },
    ]);

    planner.updateStepStatus(plan.id, 'step_1', 'completed', 'Success output');

    expect(plan.steps[0].result).toBe('Success output');
  });

  it('updateStepStatus returns false for unknown plan', () => {
    expect(planner.updateStepStatus('bad_id', 'step_1', 'completed')).toBe(false);
  });

  it('updateStepStatus returns false for unknown step', () => {
    const plan = planner.createPlan('Plan', [
      { title: 'A', description: 'First' },
    ]);

    expect(planner.updateStepStatus(plan.id, 'step_99', 'completed')).toBe(false);
  });

  it('getNextStep returns first pending step with completed dependencies', () => {
    const plan = planner.createPlan('Plan', [
      { title: 'Setup', description: 'Initialize', dependencies: [] },
      { title: 'Build', description: 'Build it', dependencies: ['step_1'] },
      { title: 'Test', description: 'Test it', dependencies: ['step_2'] },
    ]);

    // Initially, step_1 has no dependencies, so it's next
    let next = planner.getNextStep(plan.id);
    expect(next).not.toBeNull();
    expect(next!.id).toBe('step_1');

    // Complete step_1
    planner.updateStepStatus(plan.id, 'step_1', 'completed');

    // Now step_2 is ready
    next = planner.getNextStep(plan.id);
    expect(next!.id).toBe('step_2');

    // step_2 not completed yet, so step_3 is still blocked
    planner.updateStepStatus(plan.id, 'step_2', 'in_progress');
    next = planner.getNextStep(plan.id);
    expect(next).toBeNull();

    // Complete step_2
    planner.updateStepStatus(plan.id, 'step_2', 'completed');

    next = planner.getNextStep(plan.id);
    expect(next!.id).toBe('step_3');
  });

  it('getNextStep returns null when all steps completed', () => {
    const plan = planner.createPlan('Plan', [
      { title: 'A', description: 'First' },
    ]);

    planner.updateStepStatus(plan.id, 'step_1', 'completed');
    expect(planner.getNextStep(plan.id)).toBeNull();
  });

  it('getNextStep returns null for unknown plan', () => {
    expect(planner.getNextStep('nonexistent')).toBeNull();
  });

  it('getReadySteps returns all pending steps with completed dependencies', () => {
    const plan = planner.createPlan('Plan', [
      { title: 'A', description: 'No deps' },
      { title: 'B', description: 'Also no deps' },
      { title: 'C', description: 'Depends on A', dependencies: ['step_1'] },
      { title: 'D', description: 'Depends on A and B', dependencies: ['step_1', 'step_2'] },
    ]);

    // Initially A and B are ready (no deps)
    let ready = planner.getReadySteps(plan.id);
    expect(ready).toHaveLength(2);
    expect(ready.map((s) => s.id)).toEqual(['step_1', 'step_2']);

    // Complete A => C becomes ready (dep on step_1 met)
    planner.updateStepStatus(plan.id, 'step_1', 'completed');
    ready = planner.getReadySteps(plan.id);
    // B (no deps), C (dep on A done) are ready; D still needs both A and B
    expect(ready).toHaveLength(2);
    const readyIdsAfterA = ready.map((s) => s.id);
    expect(readyIdsAfterA).toContain('step_2'); // B
    expect(readyIdsAfterA).toContain('step_3'); // C

    // Complete B => D becomes ready (deps on A and B both met)
    planner.updateStepStatus(plan.id, 'step_2', 'completed');
    ready = planner.getReadySteps(plan.id);
    // C (dep on A done) and D (deps on A and B done) are now ready
    expect(ready).toHaveLength(2);
    const readyIdsAfterB = ready.map((s) => s.id);
    expect(readyIdsAfterB).toContain('step_3');
    expect(readyIdsAfterB).toContain('step_4');
  });

  it('Dependencies: step with unmet dependencies is not returned', () => {
    const plan = planner.createPlan('Plan', [
      { title: 'A', description: 'First' },
      { title: 'B', description: 'Second', dependencies: ['step_1'] },
    ]);

    // B depends on A, and A is still pending
    const ready = planner.getReadySteps(plan.id);
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe('step_1');

    // getNextStep should also skip B
    const next = planner.getNextStep(plan.id);
    expect(next!.id).toBe('step_1');
  });

  it('getProgress counts steps by status', () => {
    const plan = planner.createPlan('Plan', [
      { title: 'A', description: 'First' },
      { title: 'B', description: 'Second' },
      { title: 'C', description: 'Third' },
      { title: 'D', description: 'Fourth' },
    ]);

    planner.updateStepStatus(plan.id, 'step_1', 'completed');
    planner.updateStepStatus(plan.id, 'step_2', 'completed');
    planner.updateStepStatus(plan.id, 'step_3', 'failed');

    const progress = planner.getProgress(plan.id);

    expect(progress).toEqual({
      total: 4,
      completed: 2,
      failed: 1,
      pending: 1,
    });
  });

  it('getProgress returns zeros for unknown plan', () => {
    expect(planner.getProgress('nonexistent')).toEqual({
      total: 0,
      completed: 0,
      failed: 0,
      pending: 0,
    });
  });

  it('formatPlan returns markdown with status icons', () => {
    const plan = planner.createPlan('Deploy Pipeline', [
      { title: 'Build', description: 'Build the project' },
      { title: 'Test', description: 'Run tests' },
      { title: 'Deploy', description: 'Deploy to production' },
    ]);

    planner.updateStepStatus(plan.id, 'step_1', 'completed');
    planner.updateStepStatus(plan.id, 'step_2', 'in_progress');
    planner.updateStepStatus(plan.id, 'step_3', 'failed', 'Deployment failed');

    const formatted = planner.formatPlan(plan.id);

    expect(formatted).toContain('# Deploy Pipeline');
    expect(formatted).toContain('[x] step_1: Build');
    expect(formatted).toContain('[~] step_2: Test');
    expect(formatted).toContain('[!] step_3: Deploy');
    expect(formatted).toContain('Deployment failed');
  });

  it('formatPlan returns empty string for unknown plan', () => {
    expect(planner.formatPlan('nonexistent')).toBe('');
  });

  it('formatPlan shows [ ] for pending and [-] for skipped', () => {
    const plan = planner.createPlan('Plan', [
      { title: 'A', description: 'First' },
      { title: 'B', description: 'Second' },
    ]);

    planner.updateStepStatus(plan.id, 'step_2', 'skipped');

    const formatted = planner.formatPlan(plan.id);

    expect(formatted).toContain('[ ] step_1: A');
    expect(formatted).toContain('[-] step_2: B');
  });

  it('deletePlan removes plan', () => {
    const plan = planner.createPlan('Plan', [
      { title: 'A', description: 'First' },
    ]);

    expect(planner.deletePlan(plan.id)).toBe(true);
    expect(planner.getPlan(plan.id)).toBeNull();

    // Deleting again returns false
    expect(planner.deletePlan(plan.id)).toBe(false);
  });

  it('deletePlan returns false for unknown plan', () => {
    expect(planner.deletePlan('nonexistent')).toBe(false);
  });

  it('init stores the storage reference', async () => {
    await planner.init(storage);
    // No error should be thrown
  });

  it('handles all step statuses in formatPlan', () => {
    const plan = planner.createPlan('Plan', [
      { title: 'A', description: '1' },
      { title: 'B', description: '2' },
      { title: 'C', description: '3' },
      { title: 'D', description: '4' },
      { title: 'E', description: '5' },
    ]);

    planner.updateStepStatus(plan.id, 'step_1', 'pending');
    planner.updateStepStatus(plan.id, 'step_2', 'in_progress');
    planner.updateStepStatus(plan.id, 'step_3', 'completed');
    planner.updateStepStatus(plan.id, 'step_4', 'skipped');
    planner.updateStepStatus(plan.id, 'step_5', 'failed');

    const formatted = planner.formatPlan(plan.id);

    const statusIcons: Record<PlanStepStatus, string> = {
      pending: '[ ]',
      in_progress: '[~]',
      completed: '[x]',
      skipped: '[-]',
      failed: '[!]',
    };

    expect(formatted).toContain(`${statusIcons.pending} step_1: A`);
    expect(formatted).toContain(`${statusIcons.in_progress} step_2: B`);
    expect(formatted).toContain(`${statusIcons.completed} step_3: C`);
    expect(formatted).toContain(`${statusIcons.skipped} step_4: D`);
    expect(formatted).toContain(`${statusIcons.failed} step_5: E`);
  });
});
