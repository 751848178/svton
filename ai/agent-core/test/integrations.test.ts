import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntegrationManager } from '@svton/agent-core';
import type {
  IntegrationManifest,
} from '@svton/agent-core';
import type {
  ToolDefinition,
} from '@svton/agent-core';
import type { IToolExecutor, ToolResult, ToolCall } from '@svton/agent-core';
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

function makeExecutor(name: string): IToolExecutor {
  return {
    execute: async (call: ToolCall): Promise<ToolResult> => ({
      callId: call.id,
      output: `${name} ran successfully`,
    }),
  };
}

function makeToolDef(name: string): ToolDefinition {
  return {
    name,
    description: `Tool ${name}`,
    parameters: { type: 'object', properties: {} },
  };
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

// ==============================================================
// Tests
// ==============================================================

describe('F8 — Integrations (IntegrationManager)', () => {
  let storage: MockStorage;
  let manager: IntegrationManager;

  beforeEach(() => {
    storage = new MockStorage();
    manager = new IntegrationManager(storage);
  });

  // ----------------------------------------------------------
  // registerManifest()
  // ----------------------------------------------------------
  describe('registerManifest()', () => {
    it('registers a manifest that appears in listManifests()', () => {
      const manifest = makeManifest('slack');
      manager.registerManifest(manifest);

      const all = manager.listManifests();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('slack');
    });

    it('replaces a manifest with the same id', () => {
      manager.registerManifest(makeManifest('linear', { name: 'Old' }));
      manager.registerManifest(makeManifest('linear', { name: 'New' }));

      const all = manager.listManifests();
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe('New');
    });

    it('can register multiple manifests', () => {
      manager.registerManifest(makeManifest('slack'));
      manager.registerManifest(makeManifest('linear'));
      manager.registerManifest(makeManifest('jira'));

      expect(manager.listManifests()).toHaveLength(3);
    });
  });

  // ----------------------------------------------------------
  // enable()
  // ----------------------------------------------------------
  describe('enable()', () => {
    it('persists the integration config with credentials', async () => {
      manager.registerManifest(makeManifest('slack'));

      await manager.enable('slack', { apiKey: 'sk-123' });

      const stored = await storage.get<any>('agent:integration:slack');
      expect(stored).not.toBeNull();
      expect(stored.enabled).toBe(true);
      expect(stored.credentials.apiKey).toBe('sk-123');
    });

    it('sets isEnabled() to true after enabling', async () => {
      manager.registerManifest(makeManifest('slack'));
      await manager.enable('slack', { apiKey: 'k' });

      expect(manager.isEnabled('slack')).toBe(true);
    });

    it('throws when enabling an unknown integration', async () => {
      await expect(
        manager.enable('unknown', { apiKey: 'k' }),
      ).rejects.toThrow('Unknown integration');
    });
  });

  // ----------------------------------------------------------
  // disable()
  // ----------------------------------------------------------
  describe('disable()', () => {
    it('sets enabled=false in the persisted config', async () => {
      manager.registerManifest(makeManifest('slack'));
      await manager.enable('slack', { apiKey: 'k' });
      await manager.disable('slack');

      const stored = await storage.get<any>('agent:integration:slack');
      expect(stored.enabled).toBe(false);
    });

    it('sets isEnabled() to false after disabling', async () => {
      manager.registerManifest(makeManifest('slack'));
      await manager.enable('slack', { apiKey: 'k' });
      await manager.disable('slack');

      expect(manager.isEnabled('slack')).toBe(false);
    });

    it('does not throw when disabling an unregistered integration', async () => {
      await expect(manager.disable('never-enabled')).resolves.toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // isEnabled()
  // ----------------------------------------------------------
  describe('isEnabled()', () => {
    it('returns false for a never-enabled integration', () => {
      expect(manager.isEnabled('nothing')).toBe(false);
    });

    it('returns true only for enabled integrations', async () => {
      manager.registerManifest(makeManifest('a'));
      manager.registerManifest(makeManifest('b'));
      await manager.enable('a', { apiKey: 'k' });

      expect(manager.isEnabled('a')).toBe(true);
      expect(manager.isEnabled('b')).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // getCredential()
  // ----------------------------------------------------------
  describe('getCredential()', () => {
    it('returns the credential when enabled', async () => {
      manager.registerManifest(makeManifest('slack'));
      await manager.enable('slack', { apiKey: 'secret', token: 'tok' });

      expect(manager.getCredential('slack', 'apiKey')).toBe('secret');
      expect(manager.getCredential('slack', 'token')).toBe('tok');
    });

    it('returns undefined when the integration is disabled', async () => {
      manager.registerManifest(makeManifest('slack'));
      await manager.enable('slack', { apiKey: 's' });
      await manager.disable('slack');

      expect(manager.getCredential('slack', 'apiKey')).toBeUndefined();
    });

    it('returns undefined for a missing key', async () => {
      manager.registerManifest(makeManifest('slack'));
      await manager.enable('slack', { apiKey: 's' });

      expect(manager.getCredential('slack', 'nonexistent')).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // resolveAllTools()
  // ----------------------------------------------------------
  describe('resolveAllTools()', () => {
    it('returns tools from enabled integrations', async () => {
      const slackManifest = makeManifest('slack', {
        getTools: (creds) => [
          {
            definition: makeToolDef('slack_send_message'),
            executor: makeExecutor('slack_send_message'),
          },
        ],
      });
      manager.registerManifest(slackManifest);
      await manager.enable('slack', { apiKey: 'k' });

      const tools = manager.resolveAllTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].definition.name).toBe('slack_send_message');
    });

    it('returns empty array when no integrations are enabled', () => {
      manager.registerManifest(makeManifest('slack'));

      expect(manager.resolveAllTools()).toEqual([]);
    });

    it('returns tools from multiple enabled integrations', async () => {
      manager.registerManifest(
        makeManifest('slack', {
          getTools: () => [
            {
              definition: makeToolDef('slack_send'),
              executor: makeExecutor('slack_send'),
            },
          ],
        }),
      );
      manager.registerManifest(
        makeManifest('linear', {
          getTools: () => [
            {
              definition: makeToolDef('linear_create_issue'),
              executor: makeExecutor('linear_create_issue'),
            },
          ],
        }),
      );
      await manager.enable('slack', { apiKey: 'k' });
      await manager.enable('linear', { apiKey: 'k' });

      const tools = manager.resolveAllTools();
      const names = tools.map((t) => t.definition.name);
      expect(names).toContain('slack_send');
      expect(names).toContain('linear_create_issue');
    });

    it('does not return tools from disabled integrations', async () => {
      manager.registerManifest(
        makeManifest('slack', {
          getTools: () => [
            {
              definition: makeToolDef('slack_send'),
              executor: makeExecutor('slack_send'),
            },
          ],
        }),
      );
      await manager.enable('slack', { apiKey: 'k' });
      await manager.disable('slack');

      expect(manager.resolveAllTools()).toEqual([]);
    });

    it('handles integrations without getTools', async () => {
      manager.registerManifest(makeManifest('notools'));
      await manager.enable('notools', { apiKey: 'k' });

      expect(manager.resolveAllTools()).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // init()
  // ----------------------------------------------------------
  describe('init()', () => {
    it('loads saved configs from storage', async () => {
      // Simulate a previously saved config
      await storage.set('agent:integration:slack', {
        id: 'slack',
        enabled: true,
        credentials: { apiKey: 'loaded-key' },
        addedAt: Date.now(),
      });

      manager.registerManifest(makeManifest('slack'));

      await manager.init();

      expect(manager.isEnabled('slack')).toBe(true);
      expect(manager.getCredential('slack', 'apiKey')).toBe('loaded-key');
    });
  });
});
