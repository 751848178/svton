import { describe, it, expect, beforeEach } from 'vitest';
import { AgentDefinitionManager } from '@svton/agent-core';
import type { AgentDefinition } from '@svton/agent-core';
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

const customDef: AgentDefinition = {
  name: 'my-custom-agent',
  title: 'My Custom Agent',
  description: 'A test agent definition',
  systemPrompt: 'You are a custom agent.',
  source: 'user',
  permissions: 'default',
};

function makeRichCustomDef(): AgentDefinition {
  return {
    ...customDef,
    tools: ['file_read'],
    excludeTools: ['bash'],
    skills: ['review'],
    mcpServers: [{ name: 'docs', url: 'http://mcp.local', type: 'http' }],
  };
}

// ==============================================================
// Tests
// ==============================================================

describe('F5 — Custom Agent Definitions (AgentDefinitionManager)', () => {
  // ----------------------------------------------------------
  // Built-in defaults
  // ----------------------------------------------------------
  describe('built-in defaults', () => {
    it('getBuiltinDefaults() returns coder, researcher, planner', () => {
      const manager = new AgentDefinitionManager();
      const defaults = manager.getBuiltinDefaults();

      const names = defaults.map((d) => d.name);
      expect(names).toContain('coder');
      expect(names).toContain('researcher');
      expect(names).toContain('planner');
    });

    it('seeds the definitions on construction', () => {
      const manager = new AgentDefinitionManager();
      const all = manager.list();

      expect(all.length).toBeGreaterThanOrEqual(3);
      expect(manager.get('coder')).not.toBeNull();
      expect(manager.get('researcher')).not.toBeNull();
      expect(manager.get('planner')).not.toBeNull();
    });

    it('coder has correct default fields', () => {
      const manager = new AgentDefinitionManager();
      const coder = manager.get('coder')!;

      expect(coder.title).toBe('Coder');
      expect(coder.source).toBe('builtin');
      expect(coder.systemPrompt).toBeDefined();
    });

    it('researcher has read-only permissions and a tool allowlist', () => {
      const manager = new AgentDefinitionManager();
      const researcher = manager.get('researcher')!;

      expect(researcher.permissions).toBe('read_only');
      expect(researcher.tools).toContain('file_read');
      expect(researcher.tools).toContain('web_search');
    });

    it('planner has plan permissions', () => {
      const manager = new AgentDefinitionManager();
      const planner = manager.get('planner')!;

      expect(planner.permissions).toBe('plan');
    });

    it('returns builtin definition copies so defaults cannot be mutated through callers', () => {
      const manager = new AgentDefinitionManager();

      const researcher = manager.get('researcher')!;
      researcher.tools!.push('bash');
      manager.list().find((def) => def.name === 'planner')!.title = 'Injected Planner';

      expect(manager.get('researcher')!.tools).not.toContain('bash');
      expect(manager.get('planner')!.title).toBe('Planner');
    });
  });

  // ----------------------------------------------------------
  // register() and list()
  // ----------------------------------------------------------
  describe('register() and list()', () => {
    it('register() adds a definition that appears in list()', () => {
      const manager = new AgentDefinitionManager();

      manager.register(customDef);

      const all = manager.list();
      expect(all.some((d) => d.name === 'my-custom-agent')).toBe(true);
    });

    it('register() replaces an existing definition with the same name', () => {
      const manager = new AgentDefinitionManager();
      manager.register(customDef);
      manager.register({ ...customDef, title: 'Updated Title' });

      const def = manager.get('my-custom-agent')!;
      expect(def.title).toBe('Updated Title');
    });

    it('register(), get(), and list() protect registered definitions from caller mutation', () => {
      const manager = new AgentDefinitionManager();
      const richCustomDef = makeRichCustomDef();

      manager.register(richCustomDef);
      richCustomDef.title = 'Injected title';
      richCustomDef.tools!.push('bash');
      richCustomDef.mcpServers![0].url = 'http://evil.local';

      const fromGet = manager.get('my-custom-agent')!;
      expect(fromGet.title).toBe('My Custom Agent');
      expect(fromGet.tools).toEqual(['file_read']);
      expect(fromGet.mcpServers?.[0].url).toBe('http://mcp.local');

      fromGet.tools!.push('web_fetch');
      const fromList = manager.list().find((def) => def.name === 'my-custom-agent')!;
      fromList.mcpServers![0].name = 'injected';

      const fresh = manager.get('my-custom-agent')!;
      expect(fresh.tools).toEqual(['file_read']);
      expect(fresh.mcpServers?.[0].name).toBe('docs');
    });
  });

  // ----------------------------------------------------------
  // get()
  // ----------------------------------------------------------
  describe('get()', () => {
    it('returns the correct definition by name', () => {
      const manager = new AgentDefinitionManager();
      manager.register(customDef);

      const def = manager.get('my-custom-agent');
      expect(def).toEqual(customDef);
    });

    it('returns null for a non-existent name', () => {
      const manager = new AgentDefinitionManager();
      expect(manager.get('nonexistent')).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // save() and loadFromStorage() round-trip
  // ----------------------------------------------------------
  describe('save() and loadFromStorage()', () => {
    it('persists a definition and reloads it from storage', async () => {
      const storage = new MockStorage();
      const manager = new AgentDefinitionManager(storage);

      await manager.save(customDef);

      // Confirm it was written to storage
      const stored = await storage.get<AgentDefinition>(
        'agent:agent_def:my-custom-agent',
      );
      expect(stored).not.toBeNull();
      expect(stored!.name).toBe('my-custom-agent');
    });

    it('loadFromStorage() loads saved definitions into memory', async () => {
      const storage = new MockStorage();

      // Save a definition using one manager
      const manager1 = new AgentDefinitionManager(storage);
      await manager1.save(customDef);

      // Create a fresh manager and load from storage
      const manager2 = new AgentDefinitionManager(storage);
      await manager2.loadFromStorage();

      const loaded = manager2.get('my-custom-agent');
      expect(loaded).not.toBeNull();
      expect(loaded!.title).toBe('My Custom Agent');
    });

    it('saved definition overrides the builtin with the same name', async () => {
      const storage = new MockStorage();
      const manager = new AgentDefinitionManager(storage);

      // Save a custom version of "coder"
      await manager.save({
        name: 'coder',
        title: 'Super Coder',
        description: 'Overridden',
        source: 'user',
      });

      // Reload from storage into a fresh manager
      const manager2 = new AgentDefinitionManager(storage);
      await manager2.loadFromStorage();

      const coder = manager2.get('coder')!;
      expect(coder.title).toBe('Super Coder');
    });

    it('save() and loadFromStorage() separate storage-held definitions from manager state', async () => {
      const storage = new MockStorage();
      const manager = new AgentDefinitionManager(storage);
      const richCustomDef = makeRichCustomDef();

      await manager.save(richCustomDef);
      richCustomDef.tools!.push('after-save-mutation');
      richCustomDef.mcpServers![0].name = 'mutated-input';

      const stored = await storage.get<AgentDefinition>('agent:agent_def:my-custom-agent');
      expect(stored!.tools).toEqual(['file_read']);
      expect(stored!.mcpServers?.[0].name).toBe('docs');

      stored!.tools!.push('bash');
      stored!.mcpServers![0].url = 'http://evil.local';

      expect(manager.get('my-custom-agent')!.tools).toEqual(['file_read']);
      expect(manager.get('my-custom-agent')!.mcpServers?.[0].url).toBe('http://mcp.local');

      const manager2 = new AgentDefinitionManager(storage);
      await manager2.loadFromStorage();
      stored!.title = 'Injected stored title';
      stored!.skills!.push('evil-skill');

      expect(manager2.get('my-custom-agent')!.title).toBe('My Custom Agent');
      expect(manager2.get('my-custom-agent')!.skills).toEqual(['review']);
    });

    it('loadFromStorage() is safe when no storage is provided', async () => {
      const manager = new AgentDefinitionManager();
      await expect(manager.loadFromStorage()).resolves.toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // delete()
  // ----------------------------------------------------------
  describe('delete()', () => {
    it('removes the definition from memory', async () => {
      const storage = new MockStorage();
      const manager = new AgentDefinitionManager(storage);
      await manager.save(customDef);

      await manager.delete('my-custom-agent');

      expect(manager.get('my-custom-agent')).toBeNull();
    });

    it('removes the definition from storage', async () => {
      const storage = new MockStorage();
      const manager = new AgentDefinitionManager(storage);
      await manager.save(customDef);

      await manager.delete('my-custom-agent');

      const stored = await storage.get('agent:agent_def:my-custom-agent');
      expect(stored).toBeNull();
    });

    it('does not throw when deleting a non-existent name', async () => {
      const manager = new AgentDefinitionManager(new MockStorage());
      await expect(manager.delete('nope')).resolves.toBeUndefined();
    });
  });
});
