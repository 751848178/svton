/**
 * createAgentConfig tests — verifies tool registration, provider wiring,
 * and the search-config branching logic.
 */
import { describe, it, expect } from 'vitest';
import { createAgentConfig } from '../src/lib/create-agent-config';
import type { BrowserPlatform, IStorage } from '@svton/agent-platform';

class MemStorage implements IStorage {
  private m = new Map<string, unknown>();
  async get<T>(k: string): Promise<T | null> { return (this.m.get(k) as T) ?? null; }
  async set<T>(k: string, v: T): Promise<void> { this.m.set(k, v); }
  async delete(k: string): Promise<void> { this.m.delete(k); }
  async list(): Promise<string[]> { return Array.from(this.m.keys()); }
  async clear(): Promise<void> { this.m.clear(); }
}

function makePlatform(): BrowserPlatform {
  return {
    type: 'browser',
    capabilities: { filesystem: false, process: false, watch: false, mcpStdio: false, clipboard: false, notification: false, sandboxing: false, pty: false, documentPreview: false, computerUse: false } as any,
    fs: {} as any, process: {} as any,
    storage: new MemStorage(),
    search: {} as any,
  } as unknown as BrowserPlatform;
}

const providers = [{
  id: 'openai',
  name: 'OpenAI',
  type: 'openai' as const,
  baseUrl: 'https://api.openai.com',
  apiKey: 'sk-test',
  models: [{ id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, supportsToolUse: true }],
}];

describe('createAgentConfig', () => {
  it('returns a ready config with provider + model', async () => {
    const config = await createAgentConfig({
      providers,
      model: 'gpt-4o',
      platform: makePlatform(),
    });
    expect(config.model).toBe('gpt-4o');
    expect(config.provider).toBeDefined();
  });

  it('registers web_fetch by default', async () => {
    const config = await createAgentConfig({
      providers, model: 'gpt-4o', platform: makePlatform(),
    });
    const names = config.toolRegistry.listDefinitions().map(t => t.name);
    expect(names).toContain('web_fetch');
  });

  it('does NOT register web_search when no search config provided', async () => {
    const config = await createAgentConfig({
      providers, model: 'gpt-4o', platform: makePlatform(),
    });
    const names = config.toolRegistry.listDefinitions().map(t => t.name);
    expect(names).not.toContain('web_search');
  });

  it('registers web_search when searchEndpoint is provided', async () => {
    const config = await createAgentConfig({
      providers, model: 'gpt-4o', platform: makePlatform(),
      searchEndpoint: 'https://searxng.example.com/search',
    });
    const names = config.toolRegistry.listDefinitions().map(t => t.name);
    expect(names).toContain('web_search');
  });

  it('registers web_search when searchApiKey (Tavily) is provided', async () => {
    const config = await createAgentConfig({
      providers, model: 'gpt-4o', platform: makePlatform(),
      searchApiKey: 'tvly-test',
    });
    const names = config.toolRegistry.listDefinitions().map(t => t.name);
    expect(names).toContain('web_search');
  });

  it('registers core tools (memory, plan, image_generate)', async () => {
    const config = await createAgentConfig({
      providers, model: 'gpt-4o', platform: makePlatform(),
    });
    const names = config.toolRegistry.listDefinitions().map(t => t.name);
    expect(names).toContain('memory_save');
    expect(names).toContain('memory_recall');
    expect(names).toContain('plan_create');
    expect(names).toContain('plan_get_status');
    expect(names).toContain('plan_update_step');
  });

  it('registers code-review skill by default', async () => {
    const config = await createAgentConfig({
      providers, model: 'gpt-4o', platform: makePlatform(),
    });
    expect(config.capabilities?.skillManager).toBeDefined();
    const skills = config.capabilities!.skillManager!.list();
    expect(skills.some(s => s.name === 'code-review')).toBe(true);
  });

  it('includes git_diff and git_log_range tools when codeReview is enabled', async () => {
    const config = await createAgentConfig({
      providers, model: 'gpt-4o', platform: makePlatform(),
    });
    const names = config.toolRegistry.listDefinitions().map(t => t.name);
    expect(names).toContain('git_diff');
    expect(names).toContain('git_log_range');
  });

  it('throws when no provider configured', async () => {
    await expect(createAgentConfig({
      providers: [],
      model: 'gpt-4o',
      platform: makePlatform(),
    })).rejects.toThrow();
  });
});
