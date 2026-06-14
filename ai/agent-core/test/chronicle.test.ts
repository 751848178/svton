import { describe, it, expect, beforeEach } from 'vitest';
import { ChronicleManager } from '@svton/agent-core';
import type { ScreenCapture, ChronicleConfig } from '@svton/agent-core';
import type { IStorage, IPlatform } from '@svton/agent-platform';

// ==============================================================
// Mock Helpers
// ==============================================================

class MockStorage implements IStorage {
  store = new Map<string, any>();

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) ?? null) as T | null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = [...this.store.keys()];
    if (!prefix) return keys;
    return keys.filter((k) => k.startsWith(prefix));
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

function createMockPlatform(): IPlatform {
  return {
    type: 'tauri',
    capabilities: {
      filesystem: true,
      process: true,
      watch: false,
      mcpStdio: false,
      clipboard: false,
      notification: false,
    },
    fs: {} as any,
    process: {} as any,
    storage: {} as any,
    search: {} as any,
  };
}

function makeCapture(
  id: string,
  overrides: Partial<ScreenCapture> = {},
): ScreenCapture {
  return {
    id,
    capturedAt: Date.now(),
    imagePath: `/tmp/${id}.png`,
    ocrText: 'sample text',
    ...overrides,
  };
}

// ==============================================================
// Tests
// ==============================================================

describe('F7 — Chronicle (ChronicleManager)', () => {
  let storage: MockStorage;
  let platform: IPlatform;
  let manager: ChronicleManager;

  beforeEach(async () => {
    storage = new MockStorage();
    platform = createMockPlatform();
    manager = new ChronicleManager(storage, platform);
    await manager.init();
  });

  // ----------------------------------------------------------
  // init()
  // ----------------------------------------------------------
  describe('init()', () => {
    it('loads default config when storage is empty', async () => {
      const config = manager.getConfig();

      expect(config.intervalSeconds).toBe(30);
      expect(config.enabled).toBe(false);
      expect(config.retentionDays).toBe(7);
    });

    it('loads saved config from storage', async () => {
      // Pre-populate storage with a custom config
      await storage.set('agent:chronicle:config', {
        intervalSeconds: 60,
        enabled: true,
        retentionDays: 14,
      });

      const fresh = new ChronicleManager(storage, platform);
      await fresh.init();

      const config = fresh.getConfig();
      expect(config.intervalSeconds).toBe(60);
      expect(config.enabled).toBe(true);
      expect(config.retentionDays).toBe(14);
    });

    it('loads saved captures from storage', async () => {
      const captures = [
        makeCapture('c1', { capturedAt: 1000 }),
        makeCapture('c2', { capturedAt: 2000 }),
      ];
      await storage.set('agent:chronicle:captures', captures);

      const fresh = new ChronicleManager(storage, platform);
      await fresh.init();

      const recent = await fresh.getRecent(10);
      expect(recent).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------
  // addCapture()
  // ----------------------------------------------------------
  describe('addCapture()', () => {
    it('stores a capture that can be retrieved via getRecent()', async () => {
      const cap = makeCapture('test-1');
      await manager.addCapture(cap);

      const recent = await manager.getRecent(10);
      expect(recent).toHaveLength(1);
      expect(recent[0].id).toBe('test-1');
    });

    it('persists captures to storage', async () => {
      await manager.addCapture(makeCapture('persist-1'));

      const stored = await storage.get<ScreenCapture[]>(
        'agent:chronicle:captures',
      );
      expect(stored).not.toBeNull();
      expect(stored!.length).toBe(1);
      expect(stored![0].id).toBe('persist-1');
    });

    it('enforces retention by removing old captures', async () => {
      // Lower retention to 0 days so everything is immediately expired
      await manager.updateConfig({ retentionDays: 0 });

      await manager.addCapture(
        makeCapture('old', { capturedAt: Date.now() - 100_000 }),
      );

      // With retentionDays=0, the capture should be removed
      const recent = await manager.getRecent(10);
      // clearOlderThan(0) removes anything older than "now"
      // The capture was captured 100s ago, so it should be gone
      expect(recent).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // search()
  // ----------------------------------------------------------
  describe('search()', () => {
    beforeEach(async () => {
      // Use recent timestamps so retention doesn't delete them
      const base = Date.now();
      await manager.addCapture(
        makeCapture('s1', {
          ocrText: 'The quick brown fox',
          summary: 'animal document',
          capturedAt: base,
        }),
      );
      await manager.addCapture(
        makeCapture('s2', {
          ocrText: 'Hello World',
          summary: 'greeting card',
          capturedAt: base + 1,
        }),
      );
      await manager.addCapture(
        makeCapture('s3', {
          ocrText: 'fox news network',
          appContext: 'browser',
          capturedAt: base + 2,
        }),
      );
    });

    it('filters captures by OCR text', async () => {
      const results = await manager.search('fox');
      expect(results).toHaveLength(2);
    });

    it('filters captures by summary', async () => {
      const results = await manager.search('greeting');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('s2');
    });

    it('filters captures by appContext', async () => {
      const results = await manager.search('browser');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('s3');
    });

    it('is case-insensitive', async () => {
      const results = await manager.search('HELLO');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('s2');
    });

    it('returns empty array when nothing matches', async () => {
      const results = await manager.search('xyz-nonexistent');
      expect(results).toEqual([]);
    });

    it('respects the limit option', async () => {
      const results = await manager.search('fox', { limit: 1 });
      expect(results).toHaveLength(1);
    });

    it('sorts results newest first', async () => {
      const results = await manager.search('fox');
      expect(results[0].capturedAt).toBeGreaterThanOrEqual(results[1].capturedAt);
    });
  });

  // ----------------------------------------------------------
  // getRecent()
  // ----------------------------------------------------------
  describe('getRecent()', () => {
    beforeEach(async () => {
      const base = Date.now();
      for (let i = 0; i < 5; i++) {
        await manager.addCapture(
          makeCapture(`r${i}`, { capturedAt: base + i }),
        );
      }
    });

    it('returns the latest N captures', async () => {
      const recent = await manager.getRecent(3);
      expect(recent).toHaveLength(3);
    });

    it('sorts newest first', async () => {
      const recent = await manager.getRecent(5);
      for (let i = 0; i < recent.length - 1; i++) {
        expect(recent[i].capturedAt).toBeGreaterThanOrEqual(
          recent[i + 1].capturedAt,
        );
      }
    });

    it('returns fewer than N if not enough captures exist', async () => {
      const recent = await manager.getRecent(100);
      expect(recent).toHaveLength(5);
    });
  });

  // ----------------------------------------------------------
  // pause() and resume()
  // ----------------------------------------------------------
  describe('pause() and resume()', () => {
    it('pause() sets pausedUntil in config', async () => {
      await manager.pause(30);

      const config = manager.getConfig();
      expect(config.pausedUntil).toBeDefined();
      expect(config.pausedUntil!).toBeGreaterThan(Date.now());
    });

    it('resume() clears pausedUntil', async () => {
      await manager.pause(30);
      await manager.resume();

      const config = manager.getConfig();
      expect(config.pausedUntil).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // clearOlderThan()
  // ----------------------------------------------------------
  describe('clearOlderThan()', () => {
    it('removes captures older than the given days', async () => {
      // We need to bypass addCapture's internal retention by setting
      // the captures directly via storage, then calling clearOlderThan.
      const now = Date.now();
      const captures: ScreenCapture[] = [
        makeCapture('old-1', { capturedAt: now - 10 * 86_400_000 }),
        makeCapture('old-2', { capturedAt: now - 20 * 86_400_000 }),
        makeCapture('new-1', { capturedAt: now }),
      ];
      await storage.set('agent:chronicle:captures', captures);

      // Reload so the manager picks up the captures
      const fresh = new ChronicleManager(storage, platform);
      await fresh.init();

      const removed = await fresh.clearOlderThan(5);

      expect(removed).toBe(2);
      const recent = await fresh.getRecent(10);
      expect(recent).toHaveLength(1);
      expect(recent[0].id).toBe('new-1');
    });

    it('returns 0 when nothing is old enough', async () => {
      await manager.addCapture(makeCapture('fresh'));
      const removed = await manager.clearOlderThan(30);
      expect(removed).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // buildMemoryText()
  // ----------------------------------------------------------
  describe('buildMemoryText()', () => {
    it('returns empty string when no captures exist', async () => {
      const text = await manager.buildMemoryText();
      expect(text).toBe('');
    });

    it('includes window titles and summaries', async () => {
      await manager.addCapture(
        makeCapture('m1', {
          windowTitle: 'VS Code',
          summary: 'Editing test files',
        }),
      );

      const text = await manager.buildMemoryText();
      expect(text).toContain('VS Code');
      expect(text).toContain('Editing test files');
    });
  });
});
