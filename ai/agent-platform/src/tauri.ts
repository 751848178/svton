/**
 * Tauri Platform Implementation
 *
 * Delegates all system operations to the Tauri Rust backend via invoke().
 * Provides full filesystem, process, search, clipboard, and notification access.
 */
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
  FileWatchEvent,
  FileWatchHandler,
  FileWatcher,
  GrepOptions,
  GrepMatch,
  IChildProcess,
  SpawnOptions,
} from './types';

// Lazy-load @tauri-apps/api to avoid crashes in non-Tauri environments
type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
let _invoke: InvokeFn | null = null;

async function getInvoke(): Promise<InvokeFn> {
  if (!_invoke) {
    const api = await import('@tauri-apps/api/core' as string);
    _invoke = (api as any).invoke as InvokeFn;
  }
  return _invoke;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const fn = await getInvoke();
  return fn(cmd, args) as Promise<T>;
}

type ListenFn = (event: string, handler: (event: any) => void) => Promise<() => void>;
let _listen: ListenFn | null = null;

async function getListen(): Promise<ListenFn> {
  if (!_listen) {
    const api = await import('@tauri-apps/api/event' as string);
    _listen = (api as any).listen as ListenFn;
  }
  return _listen;
}

// ============================================================
// Tauri FileSystem
// ============================================================

class TauriFileSystem implements IFileSystem {
  async readFile(path: string, encoding?: string): Promise<string> {
    return invoke<string>('fs_read_file', { path, encoding });
  }

  async writeFile(path: string, content: string | Uint8Array): Promise<void> {
    const contentStr = typeof content === 'string' ? content : Buffer.from(content).toString('base64');
    const isBinary = typeof content !== 'string';
    await invoke<void>('fs_write_file', { path, content: contentStr, binary: isBinary });
  }

  async editFile(path: string, oldContent: string, newContent: string): Promise<boolean> {
    return invoke<boolean>('fs_edit_file', { path, oldContent, newContent });
  }

  async deleteFile(path: string): Promise<void> {
    await invoke<void>('fs_delete_file', { path });
  }

  async exists(path: string): Promise<boolean> {
    return invoke<boolean>('fs_exists', { path });
  }

  async stat(path: string): Promise<FileStat> {
    return invoke<FileStat>('fs_stat', { path });
  }

  async listDir(path: string): Promise<DirEntry[]> {
    return invoke<DirEntry[]>('fs_list_dir', { path });
  }

  watch(path: string, handler: FileWatchHandler): FileWatcher {
    let unlisten: (() => void) | null = null;
    const watchId = `fs-watch-${Date.now()}`;

    // Start watching in background
    (async () => {
      try {
        const listen = await getListen();
        unlisten = await listen(watchId, (event: any) => {
          handler(event.payload as FileWatchEvent);
        });
        await invoke('fs_watch', { path, watchId });
      } catch {
        // Watch failed silently
      }
    })();

    return {
      close() {
        unlisten?.();
        invoke('fs_unwatch', { watchId }).catch(() => {});
      },
    };
  }

  join(...paths: string[]): string {
    let result = paths.join('/').replace(/\/+/g, '/');
    if (paths.length > 0 && paths[0].startsWith('/')) {
      if (!result.startsWith('/')) result = '/' + result;
    }
    return result;
  }

  resolve(path: string): string {
    // Synchronous fallback — Tauri IPC is async
    if (path.startsWith('/')) return path;
    return path;
  }

  relative(from: string, to: string): string {
    // Simple synchronous relative path computation
    if (to.startsWith(from)) {
      const rel = to.slice(from.length).replace(/^\//, '');
      return rel || '.';
    }
    return to;
  }

  dirname(path: string): string {
    const parts = path.replace(/\\/g, '/').split('/');
    parts.pop();
    return parts.join('/') || '/';
  }

  basename(path: string): string {
    return path.replace(/\\/g, '/').split('/').pop() || '';
  }
}

// ============================================================
// Tauri Process
// ============================================================

class TauriChildProcess implements IChildProcess {
  readonly pid: number | null;
  private _processId: string;
  private _killed = false;
  private stdoutHandlers: Array<(data: string) => void> = [];
  private stderrHandlers: Array<(data: string) => void> = [];
  private exitHandlers: Array<(code: number | null, signal?: string) => void> = [];
  private unlistenFn: (() => void) | null = null;

  constructor(pid: number, processId: string) {
    this.pid = pid;
    this._processId = processId;

    // Listen for stdout/stderr/exit events
    (async () => {
      try {
        const listen = await getListen();
        const unlistenStdout = await listen(`process-stdout-${processId}`, (event: any) => {
          for (const h of this.stdoutHandlers) h(event.payload as string);
        });
        const unlistenStderr = await listen(`process-stderr-${processId}`, (event: any) => {
          for (const h of this.stderrHandlers) h(event.payload as string);
        });
        const unlistenExit = await listen(`process-exit-${processId}`, (event: any) => {
          const payload = event.payload as { code: number | null; signal?: string };
          for (const h of this.exitHandlers) h(payload.code, payload.signal);
          // Cleanup listeners
          unlistenStdout();
          unlistenStderr();
          unlistenExit();
        });
        this.unlistenFn = () => {
          unlistenStdout();
          unlistenStderr();
          unlistenExit();
        };
      } catch {
        // Event setup failed
      }
    })();
  }

  onStdout(handler: (data: string) => void): void {
    this.stdoutHandlers.push(handler);
  }

  onStderr(handler: (data: string) => void): void {
    this.stderrHandlers.push(handler);
  }

  onExit(handler: (code: number | null, signal?: string) => void): void {
    this.exitHandlers.push(handler);
  }

  kill(signal?: string): void {
    if (this._killed) return;
    this._killed = true;
    invoke('process_kill', { processId: this._processId, signal: signal ?? 'SIGTERM' }).catch(() => {});
    this.unlistenFn?.();
  }

  async write(data: string): Promise<void> {
    await invoke('process_stdin_write', { processId: this._processId, data });
  }
}

class TauriProcess implements IProcess {
  async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
    return invoke<ExecResult>('process_exec', {
      command,
      cwd: options?.cwd,
      env: options?.env,
      timeout: options?.timeout,
    });
  }

  spawn(command: string, args: string[], options?: SpawnOptions): IChildProcess {
    // Synchronous return pattern — the Rust side creates the process and returns pid + processId
    // We create the child process object and wire up events asynchronously
    // Create a placeholder that gets wired up
    const placeholder = new TauriChildProcess(-1, '');

    (async () => {
      try {
        const result = await invoke<{ pid: number; processId: string }>('process_spawn', {
          command,
          args,
          cwd: options?.cwd,
          env: options?.env,
        });
        // Create the real child process with events
        const real = new TauriChildProcess(result.pid, result.processId);
        // Forward handlers from placeholder
        for (const h of placeholder['stdoutHandlers']) real.onStdout(h);
        for (const h of placeholder['stderrHandlers']) real.onStderr(h);
        for (const h of placeholder['exitHandlers']) real.onExit(h);
        // Patch pid and processId on placeholder
        (placeholder as any).pid = result.pid;
        (placeholder as any)._processId = result.processId;
      } catch (err) {
        for (const h of placeholder['exitHandlers']) h(1, 'error');
      }
    })();

    return placeholder;
  }

  getEnv(key: string): string | undefined {
    // Synchronous — read from cached env or return undefined
    // For async version, use invoke('process_get_env')
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
    return undefined;
  }

  getCwd(): string {
    if (typeof process !== 'undefined' && process.cwd) {
      return process.cwd();
    }
    return '/';
  }
}

// ============================================================
// Tauri Storage (SQLite-backed)
// ============================================================

class TauriStorage implements IStorage {
  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await invoke<string | null>('storage_get', { key });
    if (raw == null) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    }
    // Tauri v2 IPC may auto-deserialize — if already parsed, return as-is
    return raw as unknown as T;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    await invoke<void>('storage_set', { key, value: JSON.stringify(value) });
  }

  async delete(key: string): Promise<void> {
    await invoke<void>('storage_delete', { key });
  }

  async list(prefix?: string): Promise<string[]> {
    return invoke<string[]>('storage_list', { prefix: prefix ?? '' });
  }

  async clear(): Promise<void> {
    await invoke<void>('storage_clear');
  }
}

// ============================================================
// Tauri Search (ripgrep-backed)
// ============================================================

class TauriSearch implements ISearch {
  async grep(pattern: string, paths: string[], options?: GrepOptions): Promise<GrepMatch[]> {
    return invoke<GrepMatch[]>('search_grep', {
      pattern,
      paths,
      options: {
        ignoreCase: options?.ignoreCase ?? false,
        includePattern: options?.includePattern ?? '',
        excludePattern: options?.excludePattern ?? '',
        maxResults: options?.maxResults ?? 100,
        contextLines: options?.contextLines ?? 0,
      },
    });
  }

  async glob(pattern: string, path: string): Promise<string[]> {
    return invoke<string[]>('search_glob', { pattern, path });
  }
}

// ============================================================
// Tauri Platform
// ============================================================

const TAURI_CAPABILITIES: IPlatformCapabilities = {
  filesystem: true,
  process: true,
  watch: true,
  mcpStdio: true,
  clipboard: true,
  notification: true,
  sandboxing: false,
  pty: true,
};

export class TauriPlatform implements IPlatform {
  readonly type = 'tauri' as const;
  readonly capabilities = TAURI_CAPABILITIES;
  readonly fs: IFileSystem;
  readonly process: IProcess;
  readonly storage: IStorage;
  readonly search: ISearch;

  constructor() {
    this.fs = new TauriFileSystem();
    this.process = new TauriProcess();
    this.storage = new TauriStorage();
    this.search = new TauriSearch();
  }
}
