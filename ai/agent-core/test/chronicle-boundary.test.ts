import { describe, it, expect } from 'vitest';
import { ChronicleManager } from '@svton/agent-core';
import type { ChronicleConfig, ScreenCapture } from '@svton/agent-core';
import type { IPlatform, IStorage } from '@svton/agent-platform';

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
    return keys.filter((key) => key.startsWith(prefix));
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

describe('ChronicleManager ownership boundaries', () => {
  it('isolates loaded captures from storage-owned objects', async () => {
    const storage = new MockStorage();
    const persisted = [makeCapture('loaded', { summary: 'original summary' })];
    await storage.set('agent:chronicle:captures', persisted);

    const manager = new ChronicleManager(storage, createMockPlatform());
    await manager.init();

    persisted[0].summary = 'mutated by storage owner';
    const stored = await storage.get<ScreenCapture[]>('agent:chronicle:captures');
    stored![0].summary = 'mutated by storage get';

    const recent = await manager.getRecent(1);
    expect(recent[0].summary).toBe('original summary');
  });

  it('isolates added captures from caller, storage, and returned results', async () => {
    const storage = new MockStorage();
    const manager = new ChronicleManager(storage, createMockPlatform());
    await manager.init();

    const capture = makeCapture('added', {
      ocrText: 'needle original',
      summary: 'caller summary',
    });
    await manager.addCapture(capture);

    capture.summary = 'mutated by caller';
    const stored = await storage.get<ScreenCapture[]>('agent:chronicle:captures');
    stored![0].summary = 'mutated by storage';

    const recent = await manager.getRecent(1);
    recent[0].summary = 'mutated by getRecent';

    const search = await manager.search('needle');
    search[0].summary = 'mutated by search';

    const fresh = await manager.getRecent(1);
    expect(fresh[0].summary).toBe('caller summary');
  });

  it('isolates persisted config from storage-held objects', async () => {
    const storage = new MockStorage();
    const manager = new ChronicleManager(storage, createMockPlatform());
    await manager.init();

    await manager.updateConfig({ enabled: true, retentionDays: 14 });

    const stored = await storage.get<ChronicleConfig>('agent:chronicle:config');
    stored!.retentionDays = 99;

    expect(manager.getConfig().retentionDays).toBe(14);
  });
});
