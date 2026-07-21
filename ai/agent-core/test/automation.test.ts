import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AutomationManager,
  TimerScheduler,
} from '@svton/agent-core';
import type { IAutomationScheduler } from '@svton/agent-core';
import type { IStorage } from '@svton/agent-platform';

// ==============================================================
// Mock Helpers
// ==============================================================

class MockStorage implements IStorage {
  private map = new Map<string, any>();

  async get<T>(key: string): Promise<T | null> {
    return (this.map.get(key) ?? null) as T | null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.map.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = [...this.map.keys()];
    if (!prefix) return keys;
    return keys.filter((k) => k.startsWith(prefix));
  }

  async clear(): Promise<void> {
    this.map.clear();
  }
}

/** A no-op scheduler that records calls but never fires */
class MockScheduler implements IAutomationScheduler {
  public scheduleCalls: Array<{ nextRunAt: number; handler: () => Promise<void> }> = [];
  public cancelCount = 0;

  schedule(nextRunAt: number, handler: () => Promise<void>): () => void {
    this.scheduleCalls.push({ nextRunAt, handler });
    return () => {
      this.cancelCount++;
    };
  }
}

// ==============================================================
// Tests
// ==============================================================

describe('F4 — Automations (AutomationManager)', () => {
  let storage: MockStorage;
  let scheduler: MockScheduler;
  let manager: AutomationManager;

  beforeEach(() => {
    storage = new MockStorage();
    scheduler = new MockScheduler();
    manager = new AutomationManager(storage, scheduler);
  });

  // ----------------------------------------------------------
  // create()
  // ----------------------------------------------------------
  describe('create()', () => {
    it('persists the definition and assigns an id', async () => {
      const def = await manager.create({
        name: 'Daily Report',
        description: 'Generate a report',
        trigger: { type: 'interval', minutes: 60 },
        prompt: 'Generate the daily report',
      });

      expect(def.id).toBeDefined();
      expect(def.name).toBe('Daily Report');
      expect(def.enabled).toBe(true);
      expect(def.createdAt).toBeGreaterThan(0);

      // Should be persisted
      const stored = await storage.get<any>(`agent:automation:${def.id}`);
      expect(stored).not.toBeNull();
      expect(stored.name).toBe('Daily Report');
    });

    it('respects enabled=false', async () => {
      const def = await manager.create({
        name: 'Paused',
        description: 'Starts disabled',
        trigger: { type: 'interval', minutes: 30 },
        prompt: 'test',
        enabled: false,
      });

      expect(def.enabled).toBe(false);
    });

    it('computes nextRunAt for interval triggers', async () => {
      const before = Date.now();
      const def = await manager.create({
        name: 'Interval',
        description: '',
        trigger: { type: 'interval', minutes: 15 },
        prompt: 'test',
      });

      expect(def.nextRunAt).toBeGreaterThanOrEqual(before + 15 * 60_000 - 100);
      expect(def.nextRunAt).toBeLessThanOrEqual(before + 15 * 60_000 + 1000);
    });

    it('schedules the automation via the scheduler when enabled', async () => {
      scheduler.scheduleCalls = [];

      await manager.create({
        name: 'Scheduled',
        description: '',
        trigger: { type: 'interval', minutes: 10 },
        prompt: 'test',
      });

      expect(scheduler.scheduleCalls).toHaveLength(1);
    });

    it('does NOT schedule when disabled', async () => {
      scheduler.scheduleCalls = [];

      await manager.create({
        name: 'Disabled',
        description: '',
        trigger: { type: 'interval', minutes: 10 },
        prompt: 'test',
        enabled: false,
      });

      expect(scheduler.scheduleCalls).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // list() and get()
  // ----------------------------------------------------------
  describe('list() and get()', () => {
    it('list() returns all created automations', async () => {
      await manager.create({
        name: 'A',
        description: '',
        trigger: { type: 'event' },
        prompt: 'a',
      });
      await manager.create({
        name: 'B',
        description: '',
        trigger: { type: 'event' },
        prompt: 'b',
      });

      expect(manager.list()).toHaveLength(2);
      expect(manager.list().map((a) => a.name)).toContain('A');
      expect(manager.list().map((a) => a.name)).toContain('B');
    });

    it('get() returns the correct definition', async () => {
      const created = await manager.create({
        name: 'X',
        description: 'desc',
        trigger: { type: 'event' },
        prompt: 'p',
      });

      const got = manager.get(created.id);
      expect(got).not.toBeNull();
      expect(got!.name).toBe('X');
    });

    it('get() returns null for unknown id', () => {
      expect(manager.get('nope')).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // pause() and resume()
  // ----------------------------------------------------------
  describe('pause() and resume()', () => {
    it('pause() sets enabled=false', async () => {
      const def = await manager.create({
        name: 'Pausable',
        description: '',
        trigger: { type: 'interval', minutes: 5 },
        prompt: 'x',
      });

      await manager.pause(def.id);

      const updated = manager.get(def.id);
      expect(updated!.enabled).toBe(false);
    });

    it('resume() sets enabled=true', async () => {
      const def = await manager.create({
        name: 'Resumable',
        description: '',
        trigger: { type: 'interval', minutes: 5 },
        prompt: 'x',
        enabled: false,
      });

      await manager.resume(def.id);

      const updated = manager.get(def.id);
      expect(updated!.enabled).toBe(true);
    });

    it('resume() reschedules the automation', async () => {
      const def = await manager.create({
        name: 'Re-schedule',
        description: '',
        trigger: { type: 'interval', minutes: 5 },
        prompt: 'x',
        enabled: false,
      });

      scheduler.scheduleCalls = [];
      await manager.resume(def.id);

      expect(scheduler.scheduleCalls).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // runNow() — triggers the handler
  // ----------------------------------------------------------
  describe('runNow()', () => {
    it('calls the trigger handler', async () => {
      const handler = vi.fn(async () => {});
      manager.setTriggerHandler(handler);

      const def = await manager.create({
        name: 'Trigger',
        description: '',
        trigger: { type: 'event' },
        prompt: 'run me',
      });

      await manager.runNow(def.id);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ id: def.id }),
      );
    });

    it('updates lastRunAt after running', async () => {
      const handler = vi.fn(async () => {});
      manager.setTriggerHandler(handler);

      const before = Date.now();
      const def = await manager.create({
        name: 'X',
        description: '',
        trigger: { type: 'event' },
        prompt: 'p',
      });

      await manager.runNow(def.id);

      const updated = manager.get(def.id);
      expect(updated!.lastRunAt).toBeGreaterThanOrEqual(before);
    });

    it('records scheduled trigger runs in recent history', async () => {
      const handler = vi.fn(async () => {});
      manager.setTriggerHandler(handler);
      await manager.create({
        name: 'Scheduled history',
        description: '',
        trigger: { type: 'interval', minutes: 5 },
        prompt: 'p',
      });

      await scheduler.scheduleCalls[0].handler();

      const recent = await manager.getRecentRuns();
      expect(recent).toEqual([
        expect.objectContaining({
          automationName: 'Scheduled history',
          status: 'completed',
        }),
      ]);
    });

    it('records scheduled trigger failures in recent history', async () => {
      manager.setTriggerHandler(async () => {
        throw new Error('scheduled failure');
      });
      await manager.create({
        name: 'Failing schedule',
        description: '',
        trigger: { type: 'interval', minutes: 5 },
        prompt: 'p',
      });

      await scheduler.scheduleCalls[0].handler();

      const recent = await manager.getRecentRuns();
      expect(recent).toEqual([
        expect.objectContaining({
          automationName: 'Failing schedule',
          status: 'failed',
          error: 'scheduled failure',
        }),
      ]);
    });

    it('records a failed run when no handler is set', async () => {
      const def = await manager.create({
        name: 'NoHandler',
        description: '',
        trigger: { type: 'event' },
        prompt: 'p',
      });

      const before = Date.now();
      await expect(manager.runNow(def.id)).resolves.toBeUndefined();

      const runs = await manager.getRuns(def.id);
      expect(runs).toEqual([
        expect.objectContaining({
          automationId: def.id,
          status: 'failed',
          error: 'Automation trigger handler is not configured',
        }),
      ]);
      expect(manager.get(def.id)!.lastRunAt).toBeGreaterThanOrEqual(before);
    });
  });

  // ----------------------------------------------------------
  // delete()
  // ----------------------------------------------------------
  describe('delete()', () => {
    it('removes the definition and cancels the schedule', async () => {
      const def = await manager.create({
        name: 'ToDelete',
        description: '',
        trigger: { type: 'interval', minutes: 5 },
        prompt: 'x',
      });

      scheduler.cancelCount = 0;
      await manager.delete(def.id);

      expect(manager.get(def.id)).toBeNull();
      expect(scheduler.cancelCount).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------
  // init() — loads from storage
  // ----------------------------------------------------------
  describe('init()', () => {
    it('loads persisted definitions from storage', async () => {
      // Create and persist one
      const def = await manager.create({
        name: 'Persisted',
        description: '',
        trigger: { type: 'event' },
        prompt: 'p',
      });

      // Create a new manager with the same storage
      const manager2 = new AutomationManager(storage, new MockScheduler());
      await manager2.init();

      const loaded = manager2.get(def.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('Persisted');
    });
  });
});
