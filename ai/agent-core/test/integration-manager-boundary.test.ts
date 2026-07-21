import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntegrationManager } from '@svton/agent-core';
import type { IntegrationManifest } from '@svton/agent-core';
import type { IStorage } from '@svton/agent-platform';

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
    return keys.filter((key) => key.startsWith(prefix));
  }

  async clear(): Promise<void> {
    this.map.clear();
  }
}

function makeManifest(
  id: string,
  opts: Partial<IntegrationManifest> = {},
): IntegrationManifest {
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    description: `Integration: ${id}`,
    category: 'general',
    authType: 'api_key',
    authFields: [{ key: 'apiKey', label: 'API Key', secret: true }],
    ...opts,
  };
}

describe('IntegrationManager ownership boundaries', () => {
  let storage: MockStorage;
  let manager: IntegrationManager;

  beforeEach(() => {
    storage = new MockStorage();
    manager = new IntegrationManager(storage);
  });

  it('stores and returns manifest copies', () => {
    const manifest = makeManifest('slack');
    manager.registerManifest(manifest);

    manifest.name = 'Injected from caller';
    manifest.authFields[0].label = 'Injected label';

    const listed = manager.listManifests()[0];
    expect(listed.name).toBe('Slack');
    expect(listed.authFields[0].label).toBe('API Key');

    listed.name = 'Injected from list';
    listed.authFields[0].label = 'Injected from list';

    const fresh = manager.listManifests()[0];
    expect(fresh.name).toBe('Slack');
    expect(fresh.authFields[0].label).toBe('API Key');
  });

  it('isolates enabled credentials from caller, storage, and tool factories', async () => {
    let credentialsAtFactoryEntry: Record<string, string> | undefined;
    const getTools = vi.fn((credentials: Record<string, string>) => {
      credentialsAtFactoryEntry = { ...credentials };
      credentials.apiKey = 'mutated by getTools';
      return [];
    });
    const credentials = { apiKey: 'original' };
    manager.registerManifest(makeManifest('slack', { getTools }));

    await manager.enable('slack', credentials);

    credentials.apiKey = 'mutated by caller';
    const stored = await storage.get<any>('agent:integration:slack');
    stored.credentials.apiKey = 'mutated by storage';

    expect(manager.getCredential('slack', 'apiKey')).toBe('original');

    manager.resolveAllTools();

    expect(credentialsAtFactoryEntry).toEqual({ apiKey: 'original' });
    expect(manager.getCredential('slack', 'apiKey')).toBe('original');
  });

  it('isolates loaded configs from storage-owned objects', async () => {
    const persisted = {
      id: 'slack',
      enabled: true,
      credentials: { apiKey: 'loaded-key' },
      addedAt: Date.now(),
    };
    await storage.set('agent:integration:slack', persisted);
    manager.registerManifest(makeManifest('slack'));

    await manager.init();

    persisted.credentials.apiKey = 'mutated by storage owner';
    const stored = await storage.get<any>('agent:integration:slack');
    stored.credentials.apiKey = 'mutated by storage get';

    expect(manager.getCredential('slack', 'apiKey')).toBe('loaded-key');
  });
});
