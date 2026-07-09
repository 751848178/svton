/**
 * Test helper: wraps hooks in a real AgentProvider with mock services.
 *
 * Uses the @svton/service reactive container (same as production) so hooks
 * observe real state changes. The provider is backed by:
 *  - MockProvider (canned LLM responses)
 *  - MemoryStorage (in-memory persistence)
 *  - A minimal ToolRegistry
 */
import React from 'react';
import { AgentProvider } from '../../src/service/provider';
import { ChatService } from '../../src/service/chat.service';
import { SessionService } from '../../src/service/session.service';
import { ProjectService } from '../../src/service/project.service';
import { AgentRuntime, ToolRegistry } from '@svton/agent-core';
import type { AgentConfig } from '@svton/agent-core';
import type { IPlatform, IStorage } from '@svton/agent-platform';
import { container } from '@svton/service';

// Re-export the stub-free mock provider from agent-core helpers
export { MemoryStorage } from '../../../agent-core/test/helpers';

/** Simple mock IProvider that replays queued responses. */
export class MockProvider {
  readonly name = 'mock';
  readonly models = [{ id: 'test-model', name: 'Test', contextWindow: 128000, supportsToolUse: true, supportsVision: false, supportsStreaming: true }];
  private queue: any[][] = [];
  addResponse(events: any[]) { this.queue.push(events); return this; }
  async *chat(): AsyncGenerator<any> {
    const r = this.queue.shift();
    if (r) for (const e of r) yield e;
  }
  countTokens(t: string): number { return Math.ceil(t.length / 4); }
  supportsToolUse(): boolean { return true; }
  supportsVision(): boolean { return false; }
}

/** In-memory IStorage. */
export class MemStorage implements IStorage {
  private m = new Map<string, unknown>();
  async get<T>(k: string): Promise<T | null> { return (this.m.get(k) as T) ?? null; }
  async set<T>(k: string, v: T): Promise<void> { this.m.set(k, v); }
  async delete(k: string): Promise<void> { this.m.delete(k); }
  async list(p?: string): Promise<string[]> { return Array.from(this.m.keys()).filter(k => !p || k.startsWith(p)); }
  async clear(): Promise<void> { this.m.clear(); }
}

export function makePlatform(storage?: IStorage): IPlatform {
  return {
    type: 'browser',
    capabilities: { filesystem: false, process: false, watch: false, mcpStdio: false, clipboard: false, notification: false, sandboxing: false, pty: false, documentPreview: false, computerUse: false },
    fs: {} as any, process: {} as any,
    storage: storage ?? new MemStorage(),
    search: {} as any,
  } as IPlatform;
}

export interface TestHarness {
  provider: MockProvider;
  chatService: ChatService;
  sessionService: SessionService;
  projectService: ProjectService;
  platform: IPlatform;
  storage: MemStorage;
  config: AgentConfig;
  /** Render a component tree wrapped in AgentProvider. */
  wrap: (children: React.ReactNode) => React.ReactElement;
}

/**
 * Build a test harness: creates real ChatService / SessionService /
 * ProjectService wired to a mock provider + memory storage, then wraps
 * children in an AgentProvider so hooks can consume the context.
 */
export async function createHarness(opts: { autoInit?: boolean } = {}): Promise<TestHarness> {
  const autoInit = opts.autoInit ?? true;
  const provider = new MockProvider();
  const storage = new MemStorage();
  const platform = makePlatform(storage);
  const registry = new ToolRegistry();

  const config: AgentConfig = {
    provider: provider as any,
    model: 'test-model',
    toolRegistry: registry,
    workingDir: '/',
  };

  const chatService = new ChatService();
  const sessionService = new SessionService();
  const projectService = new ProjectService();

  if (autoInit) {
    await chatService.init(platform, config);
    await sessionService.init(storage);
    await projectService.init(storage);
    // Wait for session startup (useSession creates/restores a session async)
    await new Promise(r => setTimeout(r, 50));
  }

  const wrap = ({ children }: { children?: React.ReactNode }) => (
    <AgentProvider platform={platform} config={config}>
      {children}
    </AgentProvider>
  );

  return { provider, chatService, sessionService, projectService, platform, storage, config, wrap };
}
