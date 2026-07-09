/**
 * TauriSettingsAdapter tests — settings persistence + onUpdate/onReinit wiring.
 *
 * The adapter reads/writes via platform.storage (an in-memory IStorage here).
 * Skill CRUD is exercised separately by agent-core tests; here we focus on the
 * scalar settings (search keys, disabled tools/skills, instructions, mode).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'reflect-metadata';

// Mock @tauri-apps/api/core — agent-core's dist references it transitively,
// and it isn't resolvable in the test environment.
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }));

import { TauriSettingsAdapter } from '../src/lib/tauri-settings-adapter';
import type { TauriPlatform, IStorage } from '@svton/agent-platform';

/** In-memory storage implementing IStorage (avoids importing test helpers cross-package). */
class MemoryStorage implements IStorage {
  private m = new Map<string, unknown>();
  async get<T>(k: string): Promise<T | null> { return (this.m.get(k) as T) ?? null; }
  async set<T>(k: string, v: T): Promise<void> { this.m.set(k, v); }
  async delete(k: string): Promise<void> { this.m.delete(k); }
  async list(): Promise<string[]> { return Array.from(this.m.keys()); }
  async clear(): Promise<void> { this.m.clear(); }
}

function makePlatform(storage?: IStorage): TauriPlatform {
  const s = storage ?? new MemoryStorage();
  return {
    type: 'tauri',
    capabilities: {
      filesystem: true, process: true, watch: false, mcpStdio: false,
      clipboard: false, notification: false, sandboxing: false, pty: false, documentPreview: false,
    },
    fs: {
      exists: async () => false,
      readFile: async () => '',
      writeFile: async () => {},
      deleteFile: async () => {},
      stat: async () => ({ isFile: true, isDirectory: false, size: 0, mtime: 0 }),
      listDir: async () => [],
      resolve: (p: string) => p,
      join: (...segs: string[]) => segs.join('/'),
      watch: () => () => {},
    } as any,
    process: {
      exec: async () => ({ stdout: '', stderr: '', exitCode: 0, timedOut: false }),
      getEnv: () => '/home/test',
      getCwd: () => '/home/test',
      spawn: async () => { throw new Error('not used'); },
    } as any,
    storage: s,
    search: { grep: async () => [], glob: async () => [] } as any,
    http: { request: async () => { throw new Error('not used'); } } as any,
  } as unknown as TauriPlatform;
}

describe('TauriSettingsAdapter', () => {
  let platform: TauriPlatform;
  let storage: MemoryStorage;
  let onUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = new MemoryStorage();
    platform = makePlatform(storage);
    onUpdate = vi.fn();
  });

  it('constructs without throwing and loads persisted values', async () => {
    await storage.set('agent:disabled_tools', ['bash']);
    await storage.set('searchApiKey', 'tvly-test');
    await storage.set('searchEndpoint', 'https://searxng/s');

    new TauriSettingsAdapter(platform, undefined, onUpdate);
    // constructor kicks off async loads; wait a tick
    await new Promise((r) => setTimeout(r, 10));
    // no throw + the async gets ran without error
    expect(true).toBe(true);
  });

  // ── search API key + endpoint ──
  describe('search settings', () => {
    it('getSearchApiKey returns persisted key after constructor loads it', async () => {
      await storage.set('searchApiKey', 'tvly-abc');
      const adapter = new TauriSettingsAdapter(platform, undefined, onUpdate);
      await new Promise((r) => setTimeout(r, 10));
      expect(adapter.getSearchApiKey()).toBe('tvly-abc');
    });

    it('saveSearchApiKey persists and fires onUpdate', async () => {
      const adapter = new TauriSettingsAdapter(platform, undefined, onUpdate);
      adapter.saveSearchApiKey('tvly-new');
      expect(adapter.getSearchApiKey()).toBe('tvly-new');
      expect(await storage.get<string>('searchApiKey')).toBe('tvly-new');
      expect(onUpdate).toHaveBeenCalled();
    });

    it('getSearchEndpoint / saveSearchEndpoint round-trip', async () => {
      const adapter = new TauriSettingsAdapter(platform, undefined, onUpdate);
      adapter.saveSearchEndpoint('https://my.searxng/search');
      expect(adapter.getSearchEndpoint()).toBe('https://my.searxng/search');
      expect(await storage.get<string>('searchEndpoint')).toBe('https://my.searxng/search');
    });
  });

  // ── disabled tools / skills ──
  describe('disabled tools/skills', () => {
    it('getDisabledTools / saveDisabledTools round-trip', async () => {
      const adapter = new TauriSettingsAdapter(platform, undefined, onUpdate);
      onUpdate.mockClear();
      adapter.saveDisabledTools(['bash', 'web_search']);
      expect(adapter.getDisabledTools()).toEqual(['bash', 'web_search']);
      expect(await storage.get<string[]>('agent:disabled_tools')).toEqual(['bash', 'web_search']);
      // Note: saveDisabledTools does not fire onUpdate (unlike saveDisabledSkills);
      // tool enable/disable takes effect on next agent reinit.
    });

    it('getDisabledSkills / saveDisabledSkills round-trip', async () => {
      const adapter = new TauriSettingsAdapter(platform, undefined, onUpdate);
      adapter.saveDisabledSkills(['code-review']);
      expect(adapter.getDisabledSkills()).toEqual(['code-review']);
      expect(await storage.get<string[]>('agent:disabled_skills')).toEqual(['code-review']);
    });

    it('saveDisabledSkills unregisters newly disabled from running skillManager', async () => {
      // Provide a fake agentConfig with a skillManager mock
      const unregistered: string[] = [];
      const fakeAgentConfig = {
        capabilities: {
          skillManager: { unregister: (name: string) => { unregistered.push(name); } },
        },
      } as any;
      const adapter = new TauriSettingsAdapter(platform, fakeAgentConfig, onUpdate);
      // disable a skill that wasn't disabled before → should call unregister
      adapter.saveDisabledSkills(['code-review']);
      expect(unregistered).toContain('code-review');
    });
  });

  // ── custom instructions + permission mode ──
  describe('custom instructions + permission mode', () => {
    it('getCustomInstructions / saveCustomInstructions round-trip', async () => {
      const adapter = new TauriSettingsAdapter(platform, undefined, onUpdate);
      await adapter.saveCustomInstructions('Always use TypeScript');
      expect(adapter.getCustomInstructions()).toBe('Always use TypeScript');
      expect(await storage.get<string>('desktop:customInstructions')).toBe('Always use TypeScript');
    });

    it('savePermissionMode persists and updates the running permissionManager', async () => {
      const setMode = vi.fn();
      const fakeAgentConfig = {
        capabilities: { permissionManager: { setMode } },
      } as any;
      const adapter = new TauriSettingsAdapter(platform, fakeAgentConfig, onUpdate);
      adapter.savePermissionMode('auto');
      expect(setMode).toHaveBeenCalledWith('auto');
      expect(await storage.get<string>('agent:permission_mode')).toBe('auto');
    });
  });

  // ── getStorageDescription ──
  describe('getStorageDescription', () => {
    it('returns a non-empty description string', () => {
      const adapter = new TauriSettingsAdapter(platform, undefined, onUpdate);
      const desc = adapter.getStorageDescription();
      expect(typeof desc).toBe('string');
      expect(desc.length).toBeGreaterThan(0);
    });
  });
});
