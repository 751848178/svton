import type {
  IPlatform,
  IFileSystem,
  IProcess,
  IStorage,
  ISearch,
  IPlatformCapabilities,
  ExecOptions,
  ExecResult,
  FileStat,
  DirEntry,
  FileWatchHandler,
  FileWatcher,
  GrepOptions,
  GrepMatch,
  IChildProcess,
  SpawnOptions,
} from './types';

// ============================================================
// Browser FileSystem - limited, uses OPFS where available
// ============================================================

class BrowserFileSystem implements IFileSystem {
  async readFile(_path: string): Promise<string> {
    throw new Error('FileSystem not available in browser environment');
  }

  async writeFile(_path: string, _content: string | Uint8Array): Promise<void> {
    throw new Error('FileSystem not available in browser environment');
  }

  async editFile(_path: string, _oldContent: string, _newContent: string): Promise<boolean> {
    throw new Error('FileSystem not available in browser environment');
  }

  async deleteFile(_path: string): Promise<void> {
    throw new Error('FileSystem not available in browser environment');
  }

  async exists(_path: string): Promise<boolean> {
    return false;
  }

  async stat(_path: string): Promise<FileStat> {
    throw new Error('FileSystem not available in browser environment');
  }

  async listDir(_path: string): Promise<DirEntry[]> {
    throw new Error('FileSystem not available in browser environment');
  }

  watch(_path: string, _handler: FileWatchHandler): FileWatcher {
    return { close() {} };
  }

  join(...paths: string[]): string {
    return paths.join('/').replace(/\/+/g, '/');
  }

  resolve(path: string): string {
    return path;
  }

  relative(_from: string, _to: string): string {
    return _to;
  }

  dirname(path: string): string {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/') || '/';
  }

  basename(path: string): string {
    return path.split('/').pop() || '';
  }
}

// ============================================================
// Browser Process - not available
// ============================================================

class BrowserProcess implements IProcess {
  async exec(_command: string, _options?: ExecOptions): Promise<ExecResult> {
    throw new Error('Process execution not available in browser environment');
  }

  spawn(_command: string, _args: string[], _options?: SpawnOptions): IChildProcess {
    throw new Error('Process spawning not available in browser environment');
  }

  getEnv(_key: string): string | undefined {
    return undefined;
  }

  getCwd(): string {
    return '/';
  }
}

// ============================================================
// Browser Storage - uses IndexedDB
// ============================================================

class BrowserStorage implements IStorage {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'svton-agent';
  private readonly storeName = 'key-value';
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Lazy init - don't call init() here, let it be triggered on first use
    // This prevents crashes in Node.js/test environments where indexedDB is unavailable
  }

  private ensureInit(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.init();
    }
    return this.initPromise;
  }

  private async init(): Promise<void> {
    if (this.db) return;
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB not available in this environment');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async getStore(mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    await this.ensureInit();
    const tx = this.db!.transaction(this.storeName, mode);
    return tx.objectStore(this.storeName);
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const store = await this.getStore('readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    const store = await this.getStore('readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: string): Promise<void> {
    const store = await this.getStore('readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async list(prefix?: string): Promise<string[]> {
    const store = await this.getStore('readonly');
    return new Promise((resolve, reject) => {
      const keys: string[] = [];
      const request = store.openKeyCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const key = cursor.key as string;
          if (!prefix || key.startsWith(prefix)) {
            keys.push(key);
          }
          cursor.continue();
        } else {
          resolve(keys);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    const store = await this.getStore('readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// ============================================================
// Browser Search - limited
// ============================================================

class BrowserSearch implements ISearch {
  async grep(
    _pattern: string,
    _paths: string[],
    _options?: GrepOptions,
  ): Promise<GrepMatch[]> {
    throw new Error('Search not available in browser environment');
  }

  async glob(_pattern: string, _path: string): Promise<string[]> {
    throw new Error('Search not available in browser environment');
  }
}

// ============================================================
// Browser Platform
// ============================================================

const BROWSER_CAPABILITIES: IPlatformCapabilities = {
  filesystem: false,
  process: false,
  watch: false,
  mcpStdio: false,
  clipboard: typeof navigator !== 'undefined' && !!navigator.clipboard,
  notification: typeof Notification !== 'undefined',
  sandboxing: false,
  pty: false,
};

export class BrowserPlatform implements IPlatform {
  readonly type = 'browser' as const;
  readonly capabilities = BROWSER_CAPABILITIES;
  readonly fs: IFileSystem;
  readonly process: IProcess;
  readonly storage: IStorage;
  readonly search: ISearch;

  constructor() {
    this.fs = new BrowserFileSystem();
    this.process = new BrowserProcess();
    this.storage = new BrowserStorage();
    this.search = new BrowserSearch();
  }
}
