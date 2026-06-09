import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryManager } from '@svton/agent-core';
import type { MemoryEntry } from '@svton/agent-core';
import type { IStorage, IFileSystem } from '@svton/agent-platform';

// ============================================================
// Mock Storage
// ============================================================

class MockStorage implements IStorage {
  private data = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.data.get(key) as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.data.keys());
    return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
  }

  async clear(): Promise<void> {
    this.data.clear();
  }
}

// ============================================================
// Mock File System
// ============================================================

function createMockFs(files: Record<string, string> = {}): IFileSystem {
  return {
    join: (...paths: string[]) => paths.join('/').replace(/\/+/g, '/'),
    resolve: (p: string) => p,
    relative: (_from: string, to: string) => to,
    dirname: (p: string) => {
      const parts = p.split('/').slice(0, -1);
      return parts.join('/') || '/';
    },
    basename: (p: string) => p.split('/').pop() || '',
    readFile: async (path: string) => {
      if (path in files) return files[path];
      throw new Error(`File not found: ${path}`);
    },
    writeFile: async () => {},
    editFile: async () => false,
    deleteFile: async () => {},
    exists: async (path: string) => path in files,
    stat: async () => ({ isFile: true, isDirectory: false, size: 0, modifiedAt: 0, createdAt: 0 }),
    listDir: async () => [],
    watch: () => ({ close() {} }),
  };
}

// ============================================================
// MemoryManager Tests
// ============================================================

describe('MemoryManager', () => {
  let manager: MemoryManager;
  let storage: MockStorage;

  beforeEach(() => {
    manager = new MemoryManager();
    storage = new MockStorage();
  });

  it('addProjectMemory adds entries, getProjectMemoryText returns formatted text', () => {
    manager.addProjectMemory('Always use TypeScript strict mode.', 'AGENT.md');
    manager.addProjectMemory('Prefer functional components.', 'src/AGENT.md');

    const text = manager.getProjectMemoryText();

    expect(text).toContain('Always use TypeScript strict mode.');
    expect(text).toContain('Prefer functional components.');
    expect(text).toContain('<!-- From: AGENT.md -->');
    expect(text).toContain('<!-- From: src/AGENT.md -->');
  });

  it('getProjectMemoryText returns empty string when no entries', () => {
    expect(manager.getProjectMemoryText()).toBe('');
  });

  it('saveAutoMemory persists to storage, getAutoMemoryText returns formatted text', async () => {
    await manager.init(storage);
    await manager.saveAutoMemory('User prefers dark mode.', 'learned');
    await manager.saveAutoMemory('Always add unit tests.', 'learned');

    const text = manager.getAutoMemoryText();

    expect(text).toContain('- User prefers dark mode.');
    expect(text).toContain('- Always add unit tests.');

    // Verify persistence
    const stored = await storage.get<MemoryEntry[]>('memory:auto:index');
    expect(stored).toHaveLength(2);
    expect(stored![0].content).toBe('User prefers dark mode.');
    expect(stored![1].content).toBe('Always add unit tests.');
  });

  it('getAutoMemoryText returns empty string when no entries', async () => {
    await manager.init(storage);
    expect(manager.getAutoMemoryText()).toBe('');
  });

  it('init loads auto memory from storage', async () => {
    const entries: MemoryEntry[] = [
      {
        key: 'auto:1',
        content: 'Previous learned fact',
        scope: 'session',
        source: 'auto',
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];

    await storage.set('memory:auto:index', entries);

    await manager.init(storage);

    const text = manager.getAutoMemoryText();
    expect(text).toBe('- Previous learned fact');
  });

  it('clearAutoMemory clears entries and persists', async () => {
    await manager.init(storage);
    await manager.saveAutoMemory('To be cleared', 'temp');

    expect(manager.getAutoMemoryText()).toContain('To be cleared');

    await manager.clearAutoMemory();

    expect(manager.getAutoMemoryText()).toBe('');

    // Verify cleared in storage
    const stored = await storage.get<MemoryEntry[]>('memory:auto:index');
    expect(stored).toEqual([]);
  });

  it('getAllMemoryText combines project and auto memory', async () => {
    await manager.init(storage);

    manager.addProjectMemory('Project rule: use strict TS.', 'AGENT.md');
    await manager.saveAutoMemory('Learned preference: dark mode.', 'auto');

    const text = manager.getAllMemoryText();

    expect(text).toContain('## Project Rules & Context');
    expect(text).toContain('Project rule: use strict TS.');
    expect(text).toContain('## Learned Preferences');
    expect(text).toContain('Learned preference: dark mode.');
  });

  it('getAllMemoryText returns empty string when no memory', async () => {
    await manager.init(storage);
    expect(manager.getAllMemoryText()).toBe('');
  });

  it('hasMemory returns true when any memory exists, false otherwise', async () => {
    await manager.init(storage);
    expect(manager.hasMemory).toBe(false);

    manager.addProjectMemory('Some rule', 'AGENT.md');
    expect(manager.hasMemory).toBe(true);

    // Create a fresh manager to test auto memory only
    const manager2 = new MemoryManager();
    const storage2 = new MockStorage();
    await manager2.init(storage2);
    expect(manager2.hasMemory).toBe(false);

    await manager2.saveAutoMemory('A fact', 'auto');
    expect(manager2.hasMemory).toBe(true);
  });

  it('maxAutoEntries: saving more than limit removes oldest entries', async () => {
    const limited = new MemoryManager({ maxAutoEntries: 3 });
    await limited.init(storage);

    await limited.saveAutoMemory('Entry 1', 'test');
    await limited.saveAutoMemory('Entry 2', 'test');
    await limited.saveAutoMemory('Entry 3', 'test');
    await limited.saveAutoMemory('Entry 4', 'test');
    await limited.saveAutoMemory('Entry 5', 'test');

    const text = limited.getAutoMemoryText();
    expect(text).not.toContain('Entry 1');
    expect(text).not.toContain('Entry 2');
    expect(text).toContain('Entry 3');
    expect(text).toContain('Entry 4');
    expect(text).toContain('Entry 5');

    // Verify storage only has 3 entries
    const stored = await storage.get<MemoryEntry[]>('memory:auto:index');
    expect(stored).toHaveLength(3);
  });

  it('getAllEntries returns both project and auto entries', async () => {
    await manager.init(storage);

    manager.addProjectMemory('Project rule', 'AGENT.md');
    await manager.saveAutoMemory('Auto fact', 'auto');

    const entries = manager.getAllEntries();
    expect(entries).toHaveLength(2);

    const scopes = entries.map((e) => e.scope);
    expect(scopes).toContain('project');
    expect(scopes).toContain('session');
  });

  it('loadProjectMemory walks up directory tree and loads files', async () => {
    const fs = createMockFs({
      '/home/user/project/AGENT.md': 'Project-level rules',
      '/home/user/AGENT.md': 'Home-level rules',
    });

    const count = await manager.loadProjectMemory(fs, '/home/user/project/src');

    expect(count).toBe(2);
    const text = manager.getProjectMemoryText();
    expect(text).toContain('Project-level rules');
    expect(text).toContain('Home-level rules');
  });

  it('loadProjectMemory uses custom file name', async () => {
    const fs = createMockFs({
      '/project/CUSTOM.md': 'Custom memory file',
    });

    const count = await manager.loadProjectMemory(fs, '/project', 'CUSTOM.md');

    expect(count).toBe(1);
    expect(manager.getProjectMemoryText()).toContain('Custom memory file');
  });

  it('loadProjectMemory returns 0 when no files found', async () => {
    const fs = createMockFs({});

    const count = await manager.loadProjectMemory(fs, '/nowhere');

    expect(count).toBe(0);
    expect(manager.getProjectMemoryText()).toBe('');
  });

  it('loadProjectMemory stops at root directory', async () => {
    const fs = createMockFs({
      '/AGENT.md': 'Root rules',
    });

    const count = await manager.loadProjectMemory(fs, '/');

    expect(count).toBe(1);
  });

  it('loadProjectMemory reverses entries so deeper rules have higher priority', async () => {
    const fs = createMockFs({
      '/a/b/c/AGENT.md': 'Deep rule',
      '/a/AGENT.md': 'Shallow rule',
    });

    await manager.loadProjectMemory(fs, '/a/b/c');

    const entries = manager.getAllEntries();
    // After reverse, shallow comes first, deep comes last
    const sources = entries.map((e) => e.source);
    expect(sources.indexOf('/a/AGENT.md')).toBeLessThan(sources.indexOf('/a/b/c/AGENT.md'));
  });

  it('saveAutoMemory without init does not throw', async () => {
    // Should silently return since storage is null
    await expect(manager.saveAutoMemory('test', 'test')).resolves.toBeUndefined();
  });

  it('clearAutoMemory without init does not throw', async () => {
    await expect(manager.clearAutoMemory()).resolves.toBeUndefined();
  });

  it('loadProjectMemory skips files that cannot be read', async () => {
    const fs = createMockFs({
      '/project/AGENT.md': 'Good content',
    });

    // Override exists to return true for a file that throws on read
    const originalReadFile = fs.readFile.bind(fs);
    fs.readFile = async (path: string) => {
      if (path === '/project/bad/AGENT.md') throw new Error('Permission denied');
      return originalReadFile(path);
    };
    fs.exists = async (path: string) => path === '/project/AGENT.md' || path === '/project/bad/AGENT.md';

    const count = await manager.loadProjectMemory(fs, '/project/bad');

    expect(count).toBe(1);
    expect(manager.getProjectMemoryText()).toContain('Good content');
  });
});
