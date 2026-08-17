/**
 * agent-setup tests (PI008) — verifies initAgentConfig builds a Pi-backed
 * AgentConfig with canonical Pi Models and a resolved Pi model.
 *
 * Mirrors agent-desktop/test/agent-setup.test.ts: an in-memory storage stands
 * in for platform.storage, and localStorage is seeded with a provider that has
 * an apiKey so createPiModelsForProvider is exercised.
 *
 * What this proves about the migration:
 *  - createPiModelsForProvider (PI003) is the only model-construction path —
 *    provider/model ownership stays in pi-ai.
 *  - The returned AgentConfig carries `models` (pi-ai Models) + `piModel`
 *    (resolved Model), the shape SvtonAgentRuntime + ChatService consume.
 *  - The browser-safe tool subset (web_fetch, memory_*, plan_*) is registered.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  async list(prefix?: string): Promise<string[]> {
    return Array.from(this.m.keys()).filter((key) => !prefix || key.startsWith(prefix));
  }
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

const PUBLIC_SKILL_NAMES = [
  'svton', 'svton-api-client', 'svton-service', 'engineering-craft-principles',
  'universal-craft-principles', 'verify-before-done', 'plan-before-code',
  'codegraph-cli-navigation',
] as const;

function mockPublicSkillFetch() {
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    const name = PUBLIC_SKILL_NAMES.find((candidate) => path.includes(`/skills/${candidate}/`));
    if (!name) return new Response('missing', { status: 404 });
    return new Response(`---\nname: ${name}\ndescription: ${name} description bytes\n---\nInstructions`);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('initAgentConfig — Pi-backed config construction', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    localStorage.clear();
    storage = new MemoryStorage();
    saveSettings(OPENAI_WITH_KEY);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('returns an AgentConfig with pi-ai Models and a resolved piModel', async () => {
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
    expect(names).toContain('request_user_input');
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
    saveJson(LS_DISABLED_TOOLS, ['web_fetch', 'request_user_input']);
    const config = await initAgentConfig('gpt-4o', makePlatform(storage));
    const names = config.toolRegistry.listDefinitions().map((t) => t.name);
    expect(names).not.toContain('web_fetch');
    expect(names).toContain('request_user_input');
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

  it('discovers all public skills in configured order before default code review', async () => {
    const fetchMock = mockPublicSkillFetch();
    const config = await initAgentConfig('gpt-4o', makePlatform(storage));
    const skills = config.capabilities!.skillManager!.list();
    expect(skills.map((skill) => skill.name)).toEqual([...PUBLIC_SKILL_NAMES, 'code-review']);
    expect(skills.map((skill) => skill.scope)).toEqual([
      ...PUBLIC_SKILL_NAMES.map(() => 'user' as const), 'system',
    ]);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(
      PUBLIC_SKILL_NAMES.map((name) => `/skills/${name}/SKILL.md`),
    );
  });

  it('keeps the installed E2E skill ordered with public and code-review skills without duplicates', async () => {
    mockPublicSkillFetch();
    localStorage.setItem('agent-web:e2e', JSON.stringify({ modelId: 'e2e-test-model' }));
    const expected = [...PUBLIC_SKILL_NAMES, 'e2e-timeline-context', 'code-review'];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const config = await initAgentConfig('gpt-4o', makePlatform(storage));
      const skills = config.capabilities!.skillManager!.list();
      expect(skills.map((skill) => skill.name)).toEqual(expected);
      expect(new Set(skills.map((skill) => skill.name)).size).toBe(expected.length);
      expect(skills.find((skill) => skill.name === 'e2e-timeline-context')?.scope).toBe('user');
      expect(skills.find((skill) => skill.name === 'code-review')?.scope).toBe('system');
    }
  });
});
