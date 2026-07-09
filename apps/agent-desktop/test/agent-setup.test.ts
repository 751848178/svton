/**
 * agent-setup tests — focused on initAgent's tool registration behaviour.
 *
 * Mocks:
 *  - config-store loadConfig → returns a populated SvtonConfig (skips disk)
 *  - @tauri-apps/api/core → no-op
 *  - platform.storage → in-memory
 *
 * Verifies the key recent fixes:
 *  - web_search is NOT registered when no search backend is configured
 *  - web_search IS registered when a Tavily key is present
 *  - web_fetch is always registered
 *  - disabled tools are filtered out
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'reflect-metadata';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }));

// Mock config-store to skip disk I/O and control the returned config.
const mockConfig = {
  model: { name: 'claude-sonnet-4-20250514', provider: 'anthropic' },
  providers: {
    anthropic: {
      type: 'anthropic' as const,
      base_url: 'https://api.anthropic.com',
      api_key: 'sk-ant-test',
      models: { 'claude-sonnet-4-20250514': 'Claude Sonnet 4' },
    },
  },
};
vi.mock('@/lib/config-store', () => ({
  loadConfig: vi.fn(async () => ({ config: mockConfig })),
  saveConfig: vi.fn(async () => {}),
  openConfigInEditor: vi.fn(async () => {}),
  getConfigPath: vi.fn(async () => '/home/test/.svton/config.toml'),
}));

import { initAgent } from '../src/lib/agent-setup';
import type { TauriPlatform, IStorage } from '@svton/agent-platform';

class MemoryStorage implements IStorage {
  private m = new Map<string, unknown>();
  async get<T>(k: string): Promise<T | null> { return (this.m.get(k) as T) ?? null; }
  async set<T>(k: string, v: T): Promise<void> { this.m.set(k, v); }
  async delete(k: string): Promise<void> { this.m.delete(k); }
  async list(): Promise<string[]> { return Array.from(this.m.keys()); }
  async clear(): Promise<void> { this.m.clear(); }
}

function makePlatform(storage: MemoryStorage): TauriPlatform {
  return {
    type: 'tauri',
    capabilities: {
      filesystem: true, process: true, watch: false, mcpStdio: false,
      clipboard: false, notification: false, sandboxing: false, pty: false, documentPreview: false,
    },
    fs: {
      exists: async () => false, readFile: async () => '', writeFile: async () => {},
      deleteFile: async () => {},
      stat: async () => ({ isFile: true, isDirectory: false, size: 0, mtime: 0 }),
      listDir: async () => [], resolve: (p: string) => p,
      join: (...s: string[]) => s.join('/'), watch: () => () => {},
    } as any,
    process: {
      exec: async () => ({ stdout: '', stderr: '', exitCode: 0, timedOut: false }),
      getEnv: (k: string) => k === 'HOME' ? '/home/test' : '',
      getCwd: () => '/home/test',
      spawn: async () => { throw new Error('not used'); },
    } as any,
    storage,
    search: { grep: async () => [], glob: async () => [] } as any,
    http: { request: async () => { throw new Error('not used'); } } as any,
  } as unknown as TauriPlatform;
}

describe('initAgent tool registration', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('returns ready with a config when api_key is present', async () => {
    const result = await initAgent(makePlatform(storage));
    expect(result.kind).toBe('ready');
  });

  it('registers web_fetch by default (curl-backed via platform.http)', async () => {
    const result = await initAgent(makePlatform(storage));
    if (result.kind !== 'ready') throw new Error('expected ready');
    const toolNames = result.config.toolRegistry.listDefinitions().map((t) => t.name);
    expect(toolNames).toContain('web_fetch');
  });

  it('does NOT register web_search when no search backend configured', async () => {
    const result = await initAgent(makePlatform(storage));
    if (result.kind !== 'ready') throw new Error('expected ready');
    const toolNames = result.config.toolRegistry.listDefinitions().map((t) => t.name);
    expect(toolNames).not.toContain('web_search');
  });

  it('registers web_search when a Tavily API key is stored', async () => {
    await storage.set('searchApiKey', 'tvly-test-key');
    const result = await initAgent(makePlatform(storage));
    if (result.kind !== 'ready') throw new Error('expected ready');
    const toolNames = result.config.toolRegistry.listDefinitions().map((t) => t.name);
    expect(toolNames).toContain('web_search');
  });

  it('registers web_search when a custom endpoint is stored', async () => {
    await storage.set('searchEndpoint', 'https://searxng.example.com/search');
    const result = await initAgent(makePlatform(storage));
    if (result.kind !== 'ready') throw new Error('expected ready');
    const toolNames = result.config.toolRegistry.listDefinitions().map((t) => t.name);
    expect(toolNames).toContain('web_search');
  });

  it('filters out disabled tools', async () => {
    await storage.set('agent:disabled_tools', ['bash']);
    const result = await initAgent(makePlatform(storage));
    if (result.kind !== 'ready') throw new Error('expected ready');
    const toolNames = result.config.toolRegistry.listDefinitions().map((t) => t.name);
    expect(toolNames).not.toContain('bash');
  });

  it('registers core tools (file_read, file_write, file_edit, grep, glob, memory_*)', async () => {
    const result = await initAgent(makePlatform(storage));
    if (result.kind !== 'ready') throw new Error('expected ready');
    const toolNames = result.config.toolRegistry.listDefinitions().map((t) => t.name);
    expect(toolNames).toContain('file_read');
    expect(toolNames).toContain('file_write');
    expect(toolNames).toContain('file_edit');
    expect(toolNames).toContain('grep');
    expect(toolNames).toContain('glob');
    expect(toolNames).toContain('memory_save');
    expect(toolNames).toContain('memory_recall');
  });
});
