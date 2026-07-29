/**
 * Shared test helpers for the agent-core test suite.
 *
 * Centralises the mocks that every test file used to re-implement:
 *  - {@link createMockPlatform} — an in-memory IPlatform (fs/process/storage/search/http)
 *  - {@link createMockHttpClient} — a scripted IHttpClient for web tools
 *  - {@link createMockModels} — a pi-ai `Models` collection backed by
 *    `fauxProvider` (no network, no real API key) for Pi-Agent runtime tests
 *  - re-exports {@link FakeClock} / {@link SequentialIdGenerator} from production
 *
 * Runtime tests drive the Pi-backed `SvtonAgentRuntime` through canonical
 * `AssistantMessage` scripts supplied by `createMockModels()` + `fauxProvider`.
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
import {
  createModels,
  fauxProvider,
  fauxAssistantMessage,
  fauxText,
  fauxToolCall,
  fauxThinking,
  type FauxProviderHandle,
  type RegisterFauxProviderOptions,
  type FauxResponseStep,
  type Model,
} from '@earendil-works/pi-ai';
import { FakeClock, SequentialIdGenerator } from '../../src/utils/clock';

export {
  lastPiAssistant,
  piMessageHasThinking,
  piMessageText,
  piToolCalls,
  piToolResultTexts,
} from './pi-message-selectors';

export { FakeClock, SequentialIdGenerator };
export { fauxAssistantMessage, fauxText, fauxToolCall, fauxThinking };
export {
  nativeAssistantLifecycle,
  nativeAgentEnd,
  nativeError,
  nativeTextDelta,
  nativeThinkingDelta,
  nativeToolEnd,
  nativeToolStart,
  nativeToolUpdate,
  nativeTurnBoundary,
} from './native-events';

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
    editFile: opts.fs?.editFile ?? (async () => false),
    deleteFile: opts.fs?.deleteFile ?? (async () => {}),
    stat: opts.fs?.stat ?? (async (): Promise<FileStat> => ({
      isFile: true,
      isDirectory: false,
      size: 0,
      modifiedAt: 0,
      createdAt: 0,
    })),
    listDir: opts.fs?.listDir ?? (async () => [] as DirEntry[]),
    resolve: opts.fs?.resolve ?? ((p: string) => p),
    join: opts.fs?.join ?? ((...segs: string[]) => segs.join('/')),
    relative: opts.fs?.relative ?? ((_from: string, to: string) => to),
    dirname: opts.fs?.dirname ?? ((path: string) => path.split('/').slice(0, -1).join('/')),
    basename: opts.fs?.basename ?? ((path: string) => path.split('/').at(-1) ?? ''),
    watch: opts.fs?.watch ?? (() => ({ close() {} })),
    ...opts.fs,
  };
  const process: IProcess = {
    exec: opts.process?.exec ?? (async (cmd: string, _o?: ExecOptions): Promise<ExecResult> => {
      throw new Error(`mock process.exec not configured: ${cmd}`);
    }),
    getEnv: opts.process?.getEnv ?? ((() => '') as IProcess['getEnv']),
    getCwd: opts.process?.getCwd ?? (() => '/'),
    spawn: opts.process?.spawn ?? (() => { throw new Error('mock spawn not configured'); }),
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
// Pi Models mock (fauxProvider-backed)
// ============================================================

export interface MockModelsHandle {
  /** pi-ai `Models` collection — feed into `AgentConfig.models`. */
  models: ReturnType<typeof createModels>;
  /** Resolved pi-ai `Model` for the requested id (feed into `AgentConfig.piModel`). */
  model: Model<string>;
  /** Underlying fauxProvider handle for assertions (callCount, etc.). */
  faux: FauxProviderHandle;
  /** Queue one AssistantMessage (or factory) as the next LLM response. */
  addResponse(response: FauxResponseStep): this;
  /** Replace the whole response queue. */
  setResponses(responses: FauxResponseStep[]): void;
}

/**
 * Build a pi-ai `Models` collection backed by `fauxProvider` for runtime
 * tests. No network, no real API key. Responses are scripted as
 * `AssistantMessage` objects (use `fauxAssistantMessage`, `fauxToolCall`,
 * `fauxThinking`).
 *
 * The faux provider is registered under the `openai` id with a large token
 * size so text content streams as a single delta (preserving the legacy
 * runtime tests' exact-`text_delta` assertions).
 */
export function createMockModels(
  modelId = 'test-model',
  streamOptions: Pick<RegisterFauxProviderOptions, 'tokenSize' | 'tokensPerSecond'> = {},
): MockModelsHandle {
  const faux = fauxProvider({
    api: 'openai-responses',
    provider: 'openai',
    models: [{ id: modelId }],
    tokenSize: { min: 1_000_000, max: 1_000_000 },
    ...streamOptions,
  });
  const models = createModels();
  models.setProvider(faux.provider);
  const model = faux.getModel(modelId) ?? faux.getModel();
  return {
    models,
    model,
    faux,
    addResponse(response) {
      faux.appendResponses([response]);
      return this;
    },
    setResponses(responses) {
      faux.setResponses(responses);
    },
  };
}

/** Collect all events from an async generator into an array. */
export async function collectEvents<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const ev of gen) out.push(ev);
  return out;
}
