import { describe, it, expect, beforeEach } from 'vitest';
import type { IStorage } from '@svton/agent-platform';
import { BrowserPlatform, setPlatform, getPlatform, hasPlatform } from '@svton/agent-platform';

/**
 * In-memory IStorage implementation for testing.
 * Simulates the IStorage interface without requiring IndexedDB.
 */
class MemoryStorage implements IStorage {
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
    const keys = Array.from(this.data.keys());
    if (!prefix) return keys;
    return keys.filter((k) => k.startsWith(prefix));
  }

  async clear(): Promise<void> {
    this.data.clear();
  }
}

describe('BrowserPlatform', () => {
  let platform: BrowserPlatform;

  beforeEach(() => {
    platform = new BrowserPlatform();
  });

  it('should have correct type and capabilities', () => {
    expect(platform.type).toBe('browser');
    expect(platform.capabilities.filesystem).toBe(false);
    expect(platform.capabilities.process).toBe(false);
    expect(platform.capabilities.watch).toBe(false);
    expect(platform.capabilities.mcpStdio).toBe(false);
  });

  it('should throw on filesystem operations', async () => {
    await expect(platform.fs.readFile('/any/path')).rejects.toThrow('not available');
    await expect(platform.fs.writeFile('/any/path', '')).rejects.toThrow('not available');
    await expect(platform.fs.editFile('/path', 'a', 'b')).rejects.toThrow('not available');
    await expect(platform.fs.deleteFile('/path')).rejects.toThrow('not available');
    await expect(platform.fs.stat('/path')).rejects.toThrow('not available');
    await expect(platform.fs.listDir('/path')).rejects.toThrow('not available');
  });

  it('should return false for file exists check', async () => {
    expect(await platform.fs.exists('/nonexistent')).toBe(false);
  });

  it('should throw on process execution', async () => {
    await expect(platform.process.exec('ls')).rejects.toThrow('not available');
    expect(platform.process.getEnv('PATH')).toBeUndefined();
    expect(platform.process.getCwd()).toBe('/');
  });

  it('should throw on search operations', async () => {
    await expect(platform.search.grep('pattern', [])).rejects.toThrow('not available');
    await expect(platform.search.glob('**/*.ts', '/')).rejects.toThrow('not available');
  });

  it('should provide path utilities', () => {
    expect(platform.fs.join('a', 'b', 'c')).toBe('a/b/c');
    expect(platform.fs.join('a/', '/b')).toBe('a/b');
    expect(platform.fs.dirname('/a/b/c')).toBe('/a/b');
    expect(platform.fs.basename('/a/b/c')).toBe('c');
    expect(platform.fs.basename('file.txt')).toBe('file.txt');
    expect(platform.fs.resolve('/a/b')).toBe('/a/b');
    expect(platform.fs.relative('/a', '/a/b')).toBe('/a/b');
  });

  it('should provide a noop file watcher', () => {
    const watcher = platform.fs.watch('/path', () => {});
    expect(typeof watcher.close).toBe('function');
  });
});

describe('IStorage contract (MemoryStorage)', () => {
  let storage: IStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('should store and retrieve values', async () => {
    await storage.set('key1', 'value1');
    const result = await storage.get<string>('key1');
    expect(result).toBe('value1');
  });

  it('should return null for non-existent keys', async () => {
    const result = await storage.get('nonexistent');
    expect(result).toBeNull();
  });

  it('should handle object values', async () => {
    await storage.set('obj', { name: 'test', count: 42 });
    const result = await storage.get<{ name: string; count: number }>('obj');
    expect(result).toEqual({ name: 'test', count: 42 });
  });

  it('should delete entries', async () => {
    await storage.set('toDelete', 'value');
    await storage.delete('toDelete');
    expect(await storage.get('toDelete')).toBeNull();
  });

  it('should list keys with prefix', async () => {
    await storage.set('a:1', '1');
    await storage.set('a:2', '2');
    await storage.set('b:1', '3');

    const aKeys = await storage.list('a:');
    expect(aKeys).toHaveLength(2);
    expect(aKeys).toContain('a:1');
    expect(aKeys).toContain('a:2');

    const allKeys = await storage.list();
    expect(allKeys).toHaveLength(3);
  });

  it('should clear all entries', async () => {
    await storage.set('k1', 'v1');
    await storage.set('k2', 'v2');
    await storage.clear();
    expect(await storage.list()).toHaveLength(0);
  });
});

describe('Platform context', () => {
  it('setPlatform and getPlatform should work together', () => {
    const p = new BrowserPlatform();
    setPlatform(p);
    expect(getPlatform()).toBe(p);
    expect(getPlatform().type).toBe('browser');
  });
});
