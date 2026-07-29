/**
 * agent-setup tests (PI008) — verifies initAgentConfig builds a Pi-backed
 * AgentConfig with no IProvider references (PI003 migration seam).
 *
 * Mirrors agent-desktop/test/agent-setup.test.ts: an in-memory storage stands
 * in for platform.storage, and localStorage is seeded with a provider that has
 * an apiKey so createPiModelsForProvider is exercised.
 *
 * What this proves about the migration:
 *  - createPiModelsForProvider (PI003) is the only model-construction path —
 *    the deleted OpenAIProvider/AnthropicProvider are gone.
 *  - The returned AgentConfig carries `models` (pi-ai Models) + `piModel`
 *    (resolved Model), the shape SvtonAgentRuntime + ChatService consume.
 *  - The browser-safe tool subset (web_fetch, memory_*, plan_*) is registered.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'reflect-metadata';
import type { IStorage } from '@svton/agent-platform';
import { initAgentConfig } from '@/lib/agent-setup';
import {
  saveSettings,
  saveString,
  saveJson,
  LS_SEARCH_ENDPOINT,
  LS_DISABLED_TOOLS,
} from '@/lib/settings-store';

/** In-memory IStorage (IndexedDB is unavailable in jsdom). */
class MemoryStorage implements IStorage {
  private m = new Map<string, unknown>();
  async get<T>(k: string): Promise<T | null> { return (this.m.get(k) as T) ?? null; }
  async set<T>(k: string, v: T): Promise<void> { this.m.set(k, v); }
  async delete(k: string): Promise<void> { this.m.delete(k); }
  async list(): Promise<string[]> { return Array.from(this.m.keys()); }
  async clear(): Promise<void> { this.m.clear(); }
}

/** Minimal platform with in-memory storage; initAgentConfig reads storage +
 *  process.getCwd() (SkillLoader.discover) — both stubbed for jsdom. */
function makePlatform(storage: MemoryStorage): any {
  return {
    type: 'browser',
    capabilities: {
      filesystem: false, process: false, watch: false, mcpStdio: false,
      clipboard: false, notification: false, sandboxing: false, pty: false,
      documentPreview: false, computerUse: false,
    },
    storage,
    process: { getCwd: () => '/', getEnv: () => undefined },
    fs: { readFile: async () => '', join: (...s: string[]) => s.join('/') },
  };
}

const OPENAI_WITH_KEY = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai' as const,
    baseUrl: 'https://api.openai.com',
    apiKey: 'sk-test-key',
    models: [{ id: 'gpt-4o', name: 'GPT-4o' }],
  },
];

describe('initAgentConfig — Pi-backed config construction', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    localStorage.clear();
    storage = new MemoryStorage();
    saveSettings(OPENAI_WITH_KEY);
  });

  it('returns an AgentConfig with pi-ai Models + resolved piModel (no IProvider)', async () => {
    const config = await initAgentConfig('gpt-4o', makePlatform(storage));
    expect(config.model).toBe('gpt-4o');
    expect(config.models).toBeDefined();
    expect(config.piModel).toBeDefined();
    // piModel is the resolved pi-ai Model (carries id + provider).
    expect((config.piModel as any).id).toBe('gpt-4o');
    expect((config.piModel as any).provider).toBe('openai');
  });

  it('registers the browser-safe tool subset (web_fetch + memory_* + plan_*)', async () => {
    const config = await initAgentConfig('gpt-4o', makePlatform(storage));
    const names = config.toolRegistry.listDefinitions().map((t) => t.name);
    expect(names).toContain('web_fetch');
    expect(names).toContain('memory_save');
    expect(names).toContain('memory_recall');
    expect(names).toContain('plan_create');
  });

  it('registers web_search only when a search endpoint is stored', async () => {
    // No endpoint → no web_search.
    let config = await initAgentConfig('gpt-4o', makePlatform(storage));
    expect(config.toolRegistry.listDefinitions().map((t) => t.name)).not.toContain('web_search');

    saveString(LS_SEARCH_ENDPOINT, 'https://searxng.example.com/search');
    config = await initAgentConfig('gpt-4o', makePlatform(storage));
    expect(config.toolRegistry.listDefinitions().map((t) => t.name)).toContain('web_search');
  });

  it('filters out disabled tools', async () => {
    saveJson(LS_DISABLED_TOOLS, ['web_fetch']);
    const config = await initAgentConfig('gpt-4o', makePlatform(storage));
    const names = config.toolRegistry.listDefinitions().map((t) => t.name);
    expect(names).not.toContain('web_fetch');
  });

  it('throws when no provider is configured (empty settings list)', async () => {
    localStorage.clear();
    saveSettings([]); // no providers at all → settings[0] is undefined
    await expect(initAgentConfig('gpt-4o', makePlatform(storage))).rejects.toThrow(
      /No provider configured/,
    );
  });

  it('wires capability managers (skills, memory, planning, resume)', async () => {
    const config = await initAgentConfig('gpt-4o', makePlatform(storage));
    expect(config.capabilities).toBeDefined();
    expect(config.capabilities!.skillManager).toBeDefined();
    expect(config.capabilities!.memoryManager).toBeDefined();
    expect(config.capabilities!.planningManager).toBeDefined();
    expect(config.capabilities!.resumeManager).toBeDefined();
  });
});
