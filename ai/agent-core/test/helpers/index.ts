/**
 * Shared test helpers for the agent-core test suite.
 *
 * Centralises the mocks that every test file used to re-implement:
 *  - {@link createMockPlatform} — an in-memory IPlatform (fs/process/storage/search/http)
 *  - {@link createMockHttpClient} — a scripted IHttpClient for web tools
 *  - {@link MockProvider} — an IProvider with queued responses
 *  - re-exports {@link FakeClock} / {@link SequentialIdGenerator} from production
 *
 * New tests should import from here instead of reinventing mocks.
 */

import type {
  IPlatform,
  IPlatformCapabilities,
  IFileSystem,
  IProcess,
  IStorage,
  ISearch,
  IHttpClient,
  IHttpResponse,
  ExecOptions,
  ExecResult,
  FileStat,
  DirEntry,
  GrepOptions,
  GrepMatch,
} from '@svton/agent-platform';
import type {
  IProvider,
  ChatMessage,
  ChatOptions,
  StreamEvent,
  ModelInfo,
} from '../../src/provider/types';
import { FakeClock, SequentialIdGenerator } from '../../src/utils/clock';

export { FakeClock, SequentialIdGenerator };

// ============================================================
// Storage
// ============================================================

/** Simple in-memory key-value storage implementing IStorage. */
export class MemoryStorage implements IStorage {
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
// HTTP client mock
// ============================================================

export interface MockHttpEntry {
  url?: string;          // substring match; undefined = match any
  method?: 'GET' | 'POST';
  status?: number;       // default 200
  body?: string;         // response body (text)
  json?: unknown;        // response body (JSON; overrides `body`)
  headers?: Record<string, string>;
}

class MockHttpResponse implements IHttpResponse {
  constructor(
    private readonly textBody: string,
    readonly status: number,
    readonly statusText: string,
    private readonly hdrs: Record<string, string>,
  ) {}
  get ok(): boolean { return this.status >= 200 && this.status < 300; }
  text(): Promise<string> { return Promise.resolve(this.textBody); }
  json(): Promise<unknown> { return Promise.resolve(JSON.parse(this.textBody)); }
  header(name: string): string | null {
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(this.hdrs)) {
      if (k.toLowerCase() === lower) return v;
    }
    return null;
  }
}

/**
 * Scripted HTTP client: tests push MockHttpEntry responses; `request` pops
 * them in order (optionally filtered by url substring). Throws if exhausted.
 */
export function createMockHttpClient(entries: MockHttpEntry[] = []): IHttpClient & { calls: Array<{ url: string; method?: string; body?: string }>; push: (e: MockHttpEntry) => void } {
  const queue = [...entries];
  const calls: Array<{ url: string; method?: string; body?: string }> = [];
  return {
    calls,
    push(e: MockHttpEntry) { queue.push(e); },
    async request(url, opts) {
      calls.push({ url, method: opts?.method, body: opts?.body });
      const idx = queue.findIndex((e) => !e.url || url.includes(e.url));
      const entry = idx >= 0 ? queue.splice(idx, 1)[0] : queue.shift();
      if (!entry) throw new Error(`mock http: no queued response for ${url}`);
      const body = entry.json != null ? JSON.stringify(entry.json) : (entry.body ?? '');
      return new MockHttpResponse(
        body,
        entry.status ?? 200,
        entry.status && entry.status >= 400 ? 'Error' : 'OK',
        entry.headers ?? {},
      );
    },
  };
}

// ============================================================
// Platform
// ============================================================

export interface MockPlatformOptions {
  fs?: Partial<IFileSystem>;
  process?: { exec?: IProcess['exec']; getEnv?: IProcess['getEnv']; getCwd?: IProcess['getCwd']; spawn?: IProcess['spawn'] };
  storage?: IStorage;
  search?: Partial<ISearch>;
  http?: IHttpClient;
  capabilities?: Partial<IPlatformCapabilities>;
  type?: IPlatform['type'];
}

/** Build an in-memory IPlatform for tests. All seams overridable. */
export function createMockPlatform(opts: MockPlatformOptions = {}): IPlatform {
  const storage = opts.storage ?? new MemoryStorage();
  const fs: IFileSystem = {
    exists: opts.fs?.exists ?? (async () => false),
    readFile: opts.fs?.readFile ?? (async () => ''),
    writeFile: opts.fs?.writeFile ?? (async () => {}),
    deleteFile: opts.fs?.deleteFile ?? (async () => {}),
    stat: opts.fs?.stat ?? (async () => ({ isFile: true, isDirectory: false, size: 0, mtime: 0 }) as FileStat),
    listDir: opts.fs?.listDir ?? (async () => [] as DirEntry[]),
    resolve: opts.fs?.resolve ?? ((p: string) => p),
    join: opts.fs?.join ?? ((...segs: string[]) => segs.join('/')),
    watch: opts.fs?.watch ?? (() => () => {}),
    ...opts.fs,
  };
  const process: IProcess = {
    exec: opts.process?.exec ?? (async (cmd: string, _o?: ExecOptions): Promise<ExecResult> => {
      throw new Error(`mock process.exec not configured: ${cmd}`);
    }),
    getEnv: opts.process?.getEnv ?? ((() => '') as IProcess['getEnv']),
    getCwd: opts.process?.getCwd ?? (() => '/'),
    spawn: opts.process?.spawn ?? (async () => { throw new Error('mock spawn not configured'); }),
  };
  const search: ISearch = {
    grep: opts.search?.grep ?? (async () => [] as GrepMatch[]),
    glob: opts.search?.glob ?? (async () => []),
  };
  const capabilities: IPlatformCapabilities = {
    filesystem: true,
    process: true,
    watch: false,
    mcpStdio: false,
    clipboard: false,
    notification: false,
    sandboxing: false,
    pty: false,
    documentPreview: false,
    computerUse: false,
    ...opts.capabilities,
  };
  const platform: IPlatform = {
    type: opts.type ?? 'tauri',
    capabilities,
    fs,
    process,
    storage,
    search,
  };
  if (opts.http) (platform as { http?: IHttpClient }).http = opts.http;
  return platform;
}

// ============================================================
// Provider mock
// ============================================================

/**
 * IProvider mock with a queue of response scripts. Each `chat()` call pops
 * one script (an array of StreamEvents) and replays them. Throws if empty.
 */
export class MockProvider implements IProvider {
  readonly name = 'mock';
  readonly models: ModelInfo[] = [{ id: 'mock-model', name: 'Mock', contextWindow: 128000, supportsToolUse: true, supportsVision: false, supportsStreaming: true }];
  private queue: StreamEvent[][] = [];
  addResponse(events: StreamEvent[]) { this.queue.push(events); return this; }
  async *chat(_messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<StreamEvent> {
    const script = this.queue.shift();
    if (!script) throw new Error('MockProvider: no queued response');
    for (const ev of script) yield ev;
  }
  countTokens(text: string): number { return Math.ceil(text.length / 4); }
  supportsToolUse(): boolean { return true; }
  supportsVision(): boolean { return false; }
}

/** Collect all events from an async generator into an array. */
export async function collectEvents<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const ev of gen) out.push(ev);
  return out;
}
