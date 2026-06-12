import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginManager } from '@svton/agent-core';
import type { IStorage, IFileSystem } from '@svton/agent-platform';
import type { PluginManifest, PluginInstallRecord } from '@svton/agent-core';

// ============================================================
// Mock implementations
// ============================================================

class MockStorage implements IStorage {
  private data = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | null> {
    return (this.data.get(key) as T) ?? null;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = [...this.data.keys()];
    if (prefix) {
      return keys.filter((k) => k.startsWith(prefix));
    }
    return keys;
  }

  async clear(): Promise<void> {
    this.data.clear();
  }

  /** Test helper: seed storage with data */
  seed(entries: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(entries)) {
      this.data.set(key, value);
    }
  }
}

class MockFileSystem implements IFileSystem {
  private files = new Map<string, string>();

  readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      return Promise.reject(new Error(`File not found: ${path}`));
    }
    return Promise.resolve(content);
  }

  writeFile(path: string, content: string | Uint8Array): Promise<void> {
    this.files.set(path, typeof content === 'string' ? content : new TextDecoder().decode(content));
    return Promise.resolve();
  }

  editFile(path: string, oldContent: string, newContent: string): Promise<boolean> {
    const current = this.files.get(path);
    if (current === undefined) return Promise.resolve(false);
    const updated = current.replace(oldContent, newContent);
    if (updated === current && !current.includes(oldContent)) return Promise.resolve(false);
    this.files.set(path, updated);
    return Promise.resolve(true);
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
  }

  exists(path: string): Promise<boolean> {
    return Promise.resolve(this.files.has(path));
  }

  async stat(_path: string) {
    return {
      isFile: true,
      isDirectory: false,
      size: 0,
      modifiedAt: Date.now(),
      createdAt: Date.now(),
    };
  }

  async listDir(path: string) {
    const entries = [];
    for (const key of this.files.keys()) {
      if (key.startsWith(path)) {
        entries.push({
          name: key.split('/').pop()!,
          path: key,
          isFile: true,
          isDirectory: false,
        });
      }
    }
    return entries;
  }

  watch() {
    return { close: vi.fn() };
  }

  join(...paths: string[]): string {
    return paths.join('/');
  }

  resolve(path: string): string {
    return path;
  }

  relative(from: string, to: string): string {
    return to.startsWith(from) ? to.slice(from.length + 1) : to;
  }

  dirname(path: string): string {
    return path.split('/').slice(0, -1).join('/');
  }

  basename(path: string): string {
    return path.split('/').pop()!;
  }

  /** Test helper: seed a file */
  addFile(path: string, content: string): void {
    this.files.set(path, content);
  }
}

// ============================================================
// Helpers
// ============================================================

const VALID_MANIFEST: PluginManifest = {
  name: 'test-plugin',
  version: '1.0.0',
  description: 'A test plugin',
};

function makeRecord(overrides: Partial<PluginInstallRecord> = {}): PluginInstallRecord {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    source: 'local',
    installedAt: Date.now(),
    enabled: true,
    manifest: { ...VALID_MANIFEST },
    ...overrides,
  };
}

function seedPluginInStorage(storage: MockStorage, record: PluginInstallRecord): void {
  const existingNames: string[] = (storage as any).data.get('agent:plugin_registry') ?? [];
  if (!existingNames.includes(record.name)) {
    existingNames.push(record.name);
  }
  storage.seed({
    'agent:plugin_registry': existingNames,
    [`agent:plugin:${record.name}`]: record,
  });
}

function makeManager(): { manager: PluginManager; storage: MockStorage } {
  const manager = new PluginManager();
  const storage = new MockStorage();
  return { manager, storage };
}

async function initManager(): Promise<{ manager: PluginManager; storage: MockStorage }> {
  const { manager, storage } = makeManager();
  await manager.init(storage);
  return { manager, storage };
}

// ============================================================
// Tests
// ============================================================

describe('PluginManager', () => {
  // ----------------------------------------------------------
  // init
  // ----------------------------------------------------------

  describe('init', () => {
    it('with empty storage returns empty plugins', async () => {
      const { manager } = await initManager();
      expect(manager.list()).toEqual([]);
    });

    it('loads existing registry from storage', async () => {
      const { manager, storage } = makeManager();
      const record = makeRecord({ name: 'existing-plugin', version: '2.0.0' });
      seedPluginInStorage(storage, record);

      await manager.init(storage);
      const list = manager.list();

      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('existing-plugin');
      expect(list[0].version).toBe('2.0.0');
    });
  });

  // ----------------------------------------------------------
  // installFromDir
  // ----------------------------------------------------------

  describe('installFromDir', () => {
    it('success with valid manifest', async () => {
      const { manager } = await initManager();
      const fs = new MockFileSystem();
      const manifestPath = '/plugins/test-plugin/.svton-plugin/plugin.json';
      fs.addFile(manifestPath, JSON.stringify(VALID_MANIFEST));

      const record = await manager.installFromDir('/plugins/test-plugin', fs);

      expect(record.name).toBe('test-plugin');
      expect(record.version).toBe('1.0.0');
      expect(record.source).toBe('local');
      expect(record.sourceUrl).toBe('/plugins/test-plugin');
      expect(record.path).toBe('/plugins/test-plugin');
      expect(record.enabled).toBe(true);
      expect(record.manifest).toEqual(VALID_MANIFEST);
      expect(typeof record.installedAt).toBe('number');

      // Also check in-memory list
      expect(manager.list()).toHaveLength(1);
      expect(manager.list()[0].name).toBe('test-plugin');
    });

    it('throws when manifest not found', async () => {
      const { manager } = await initManager();
      const fs = new MockFileSystem();
      // No plugin.json added

      await expect(
        manager.installFromDir('/plugins/missing', fs),
      ).rejects.toThrow('No plugin manifest found at /plugins/missing/.svton-plugin/plugin.json');
    });

    it('throws when manifest missing name', async () => {
      const { manager } = await initManager();
      const fs = new MockFileSystem();
      const badManifest = { version: '1.0.0' };
      fs.addFile('/plugins/bad/.svton-plugin/plugin.json', JSON.stringify(badManifest));

      await expect(
        manager.installFromDir('/plugins/bad', fs),
      ).rejects.toThrow('Plugin manifest must have a "name" field');
    });

    it('throws when manifest missing version', async () => {
      const { manager } = await initManager();
      const fs = new MockFileSystem();
      const badManifest = { name: 'no-version' };
      fs.addFile('/plugins/bad/.svton-plugin/plugin.json', JSON.stringify(badManifest));

      await expect(
        manager.installFromDir('/plugins/bad', fs),
      ).rejects.toThrow('Plugin manifest must have a "version" field');
    });

    it('updates existing plugin (re-install)', async () => {
      const { manager } = await initManager();
      const fs = new MockFileSystem();

      // First install
      const v1Manifest: PluginManifest = { name: 'my-plugin', version: '1.0.0' };
      fs.addFile('/plugins/my-plugin-v1/.svton-plugin/plugin.json', JSON.stringify(v1Manifest));
      const first = await manager.installFromDir('/plugins/my-plugin-v1', fs);
      expect(first.version).toBe('1.0.0');

      // Re-install with v2 — same name, new version
      const v2Manifest: PluginManifest = { name: 'my-plugin', version: '2.0.0' };
      fs.addFile('/plugins/my-plugin-v2/.svton-plugin/plugin.json', JSON.stringify(v2Manifest));
      const second = await manager.installFromDir('/plugins/my-plugin-v2', fs);
      expect(second.version).toBe('2.0.0');
      expect(second.sourceUrl).toBe('/plugins/my-plugin-v2');
      expect(second.path).toBe('/plugins/my-plugin-v2');

      // Should still be exactly one plugin in the list
      expect(manager.list()).toHaveLength(1);
      expect(manager.list()[0].version).toBe('2.0.0');
    });
  });

  // ----------------------------------------------------------
  // uninstall
  // ----------------------------------------------------------

  describe('uninstall', () => {
    it('removes plugin', async () => {
      const { manager, storage } = await initManager();
      const record = makeRecord({ name: 'remove-me' });
      seedPluginInStorage(storage, record);
      await manager.init(storage);

      expect(manager.list()).toHaveLength(1);
      await manager.uninstall('remove-me');
      expect(manager.list()).toHaveLength(0);
    });

    it('is a no-op for non-existent plugin', async () => {
      const { manager, storage } = await initManager();
      const record = makeRecord({ name: 'keep-me' });
      seedPluginInStorage(storage, record);
      await manager.init(storage);

      // Uninstalling something that does not exist should not throw
      await manager.uninstall('ghost-plugin');
      expect(manager.list()).toHaveLength(1);
      expect(manager.list()[0].name).toBe('keep-me');
    });
  });

  // ----------------------------------------------------------
  // enable
  // ----------------------------------------------------------

  describe('enable', () => {
    it('sets enabled=true', async () => {
      const { manager, storage } = await initManager();
      const record = makeRecord({ name: 'disabled-plugin', enabled: false });
      seedPluginInStorage(storage, record);
      await manager.init(storage);

      expect(manager.list()[0].enabled).toBe(false);

      await manager.enable('disabled-plugin');

      expect(manager.list()[0].enabled).toBe(true);
    });

    it('is a no-op if already enabled', async () => {
      const { manager, storage } = await initManager();
      const record = makeRecord({ name: 'already-enabled', enabled: true });
      seedPluginInStorage(storage, record);
      await manager.init(storage);

      const before = manager.list()[0];
      await manager.enable('already-enabled');
      const after = manager.list()[0];

      // enabled stays true, installedAt unchanged
      expect(after.enabled).toBe(true);
      expect(after.installedAt).toBe(before.installedAt);
    });

    it('is a no-op if plugin not found', async () => {
      const { manager } = await initManager();

      // Should not throw
      await manager.enable('does-not-exist');
      expect(manager.list()).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // disable
  // ----------------------------------------------------------

  describe('disable', () => {
    it('sets enabled=false', async () => {
      const { manager, storage } = await initManager();
      const record = makeRecord({ name: 'enabled-plugin', enabled: true });
      seedPluginInStorage(storage, record);
      await manager.init(storage);

      expect(manager.list()[0].enabled).toBe(true);

      await manager.disable('enabled-plugin');

      expect(manager.list()[0].enabled).toBe(false);
    });

    it('is a no-op if already disabled', async () => {
      const { manager, storage } = await initManager();
      const record = makeRecord({ name: 'already-disabled', enabled: false });
      seedPluginInStorage(storage, record);
      await manager.init(storage);

      const before = manager.list()[0];
      await manager.disable('already-disabled');
      const after = manager.list()[0];

      expect(after.enabled).toBe(false);
      expect(after.installedAt).toBe(before.installedAt);
    });

    it('is a no-op if plugin not found', async () => {
      const { manager } = await initManager();

      await manager.disable('does-not-exist');
      expect(manager.list()).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // getManifest
  // ----------------------------------------------------------

  describe('getManifest', () => {
    it('returns manifest for installed plugin', async () => {
      const { manager, storage } = await initManager();
      const manifest: PluginManifest = { name: 'manifest-test', version: '3.0.0', description: 'Hello' };
      const record = makeRecord({ name: 'manifest-test', manifest });
      seedPluginInStorage(storage, record);
      await manager.init(storage);

      const result = manager.getManifest('manifest-test');

      expect(result).toEqual(manifest);
    });

    it('returns undefined for unknown plugin', () => {
      const { manager } = makeManager();
      // No init needed for pure in-memory query, but let's be consistent
      const result = manager.getManifest('no-such-plugin');
      expect(result).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // list
  // ----------------------------------------------------------

  describe('list', () => {
    it('returns all records', async () => {
      const { manager, storage } = await initManager();
      const r1 = makeRecord({ name: 'plugin-a' });
      const r2 = makeRecord({ name: 'plugin-b' });
      seedPluginInStorage(storage, r1);
      seedPluginInStorage(storage, r2);
      await manager.init(storage);

      const list = manager.list();
      expect(list).toHaveLength(2);
      const names = list.map((p) => p.name).sort();
      expect(names).toEqual(['plugin-a', 'plugin-b']);
    });
  });

  // ----------------------------------------------------------
  // getEnabledPlugins
  // ----------------------------------------------------------

  describe('getEnabledPlugins', () => {
    it('returns only enabled plugins', async () => {
      const { manager, storage } = await initManager();
      const enabled1 = makeRecord({ name: 'on', enabled: true });
      const disabled1 = makeRecord({ name: 'off', enabled: false });
      const enabled2 = makeRecord({ name: 'also-on', enabled: true });
      seedPluginInStorage(storage, enabled1);
      seedPluginInStorage(storage, disabled1);
      seedPluginInStorage(storage, enabled2);
      await manager.init(storage);

      const enabled = manager.getEnabledPlugins();
      expect(enabled).toHaveLength(2);
      const names = enabled.map((p) => p.name).sort();
      expect(names).toEqual(['also-on', 'on']);
    });
  });

  // ----------------------------------------------------------
  // loadRegistry — edge case
  // ----------------------------------------------------------

  describe('loadRegistry handles corrupted data gracefully', () => {
    it('handles non-array registry value', async () => {
      const { manager, storage } = makeManager();
      storage.seed({ 'agent:plugin_registry': 'not-an-array' });
      await manager.init(storage);
      expect(manager.list()).toEqual([]);
    });

    it('handles null registry value', async () => {
      const { manager, storage } = makeManager();
      storage.seed({ 'agent:plugin_registry': null });
      await manager.init(storage);
      expect(manager.list()).toEqual([]);
    });

    it('skips records where stored name does not match key', async () => {
      const { manager, storage } = makeManager();
      // Registry says 'plugin-x' but the record under that key has name 'plugin-y'
      storage.seed({
        'agent:plugin_registry': ['plugin-x'],
        'agent:plugin:plugin-x': { name: 'plugin-y', version: '1.0.0' },
      });
      await manager.init(storage);
      // Should skip the mismatched record
      expect(manager.list()).toEqual([]);
    });

    it('skips non-object records', async () => {
      const { manager, storage } = makeManager();
      storage.seed({
        'agent:plugin_registry': ['bad'],
        'agent:plugin:bad': 'string-not-object',
      });
      await manager.init(storage);
      expect(manager.list()).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // installFromGit
  // ----------------------------------------------------------

  describe('installFromGit', () => {
    it('success with valid repo', async () => {
      const { manager } = await initManager();
      const fs = new MockFileSystem();
      const exec = vi.fn();

      // git clone succeeds
      exec.mockResolvedValueOnce({ exitCode: 0, stderr: '' });
      // cleanup rm -rf succeeds
      exec.mockResolvedValueOnce({ exitCode: 0, stderr: '' });

      // The plugin.json must exist at the tmp dir
      const manifest: PluginManifest = { name: 'git-plugin', version: '1.0.0' };
      // installFromDir will be called with /tmp/svton-plugin-<timestamp>
      // We pre-seed all matching paths via a wildcard-like approach:
      // Since we cannot predict the exact tmp dir name, we add files for a path
      // that installFromDir will see. Mock join returns concatenated paths.
      // We add the manifest at every possible path by making readFile dynamic.
      // Actually, the simplest approach: add the file with join result.
      // But MockFileSystem.join just concatenates with '/'.
      // The tmpDir will be /tmp/svton-plugin-<timestamp> where timestamp is Date.now().
      // We'll just add files for a known path pattern and rely on the mock.
      //
      // Easier: just add files for a path the mock will match. Since we can't
      // predict Date.now(), we override readFile to be more lenient:
      const originalReadFile = fs.readFile.bind(fs);
      const originalExists = fs.exists.bind(fs);
      (fs as any).readFile = async (path: string) => {
        if (path.endsWith('.svton-plugin/plugin.json')) {
          return JSON.stringify(manifest);
        }
        return originalReadFile(path);
      };
      (fs as any).exists = async (path: string) => {
        if (path.endsWith('.svton-plugin/plugin.json')) {
          return true;
        }
        return originalExists(path);
      };

      const record = await manager.installFromGit(
        'https://github.com/example/plugin.git',
        'main',
        fs,
        exec,
      );

      expect(record.name).toBe('git-plugin');
      expect(record.version).toBe('1.0.0');
      expect(record.source).toBe('git');
      expect(record.sourceUrl).toBe('https://github.com/example/plugin.git');

      // Verify git clone was called with branch ref
      expect(exec).toHaveBeenCalledTimes(2);
      const cloneCall = exec.mock.calls[0][0] as string;
      expect(cloneCall).toContain('git clone');
      expect(cloneCall).toContain('--branch main');
      expect(cloneCall).toContain('https://github.com/example/plugin.git');
    });

    it('fails when git clone fails', async () => {
      const { manager } = await initManager();
      const fs = new MockFileSystem();
      const exec = vi.fn().mockResolvedValue({
        exitCode: 128,
        stderr: 'fatal: repository not found',
      });

      await expect(
        manager.installFromGit(
          'https://github.com/example/bad-repo.git',
          undefined,
          fs,
          exec,
        ),
      ).rejects.toThrow('git clone failed: fatal: repository not found');
    });

    it('calls git clone without --branch when ref is undefined', async () => {
      const { manager } = await initManager();
      const fs = new MockFileSystem();
      const exec = vi.fn();

      exec.mockResolvedValueOnce({ exitCode: 0, stderr: '' });
      exec.mockResolvedValueOnce({ exitCode: 0, stderr: '' });

      // Make installFromDir succeed
      const manifest: PluginManifest = { name: 'git-plugin', version: '1.0.0' };
      (fs as any).readFile = async (path: string) => {
        if (path.endsWith('.svton-plugin/plugin.json')) return JSON.stringify(manifest);
        throw new Error(`File not found: ${path}`);
      };
      (fs as any).exists = async (path: string) => path.endsWith('.svton-plugin/plugin.json');

      await manager.installFromGit(
        'https://github.com/example/plugin.git',
        undefined,
        fs,
        exec,
      );

      const cloneCall = exec.mock.calls[0][0] as string;
      expect(cloneCall).not.toContain('--branch');
    });
  });
});
