/**
 * ChatService skill_activated event handling.
 *
 * Verifies that when the runtime emits `skill_activated`, ChatService stores
 * the skill names on the assistant message's `activeSkills` field, so the UI
 * (ActivityIndicator) can render "正在使用 <skill>...".
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'reflect-metadata';
import { ChatService } from '../src/service/chat.service';
import { ToolRegistry, SkillManager } from '@svton/agent-core';
import type {
  IProvider, StreamEvent, ChatMessage, ChatOptions, ModelInfo,
  ToolDefinition, ToolCall, ToolResult, ToolContext, IToolExecutor,
} from '@svton/agent-core';
import type { IPlatform, IStorage } from '@svton/agent-platform';

class MockProvider implements IProvider {
  readonly name = 'mock';
  readonly models: ModelInfo[] = [
    { id: 'test-model', name: 'Test', contextWindow: 128000, supportsToolUse: true, supportsVision: false, supportsStreaming: true },
  ];
  private queue: StreamEvent[][] = [];
  addResponse(events: StreamEvent[]): void { this.queue.push(events); }
  async *chat(_m: ChatMessage[], _o: ChatOptions): AsyncGenerator<StreamEvent> {
    const r = this.queue.shift();
    if (r) for (const e of r) yield e;
  }
  countTokens(t: string): number { return Math.ceil(t.length / 4); }
  supportsToolUse(): boolean { return true; }
  supportsVision(): boolean { return false; }
}

class MemoryStorage implements IStorage {
  private m = new Map<string, unknown>();
  async get<T>(k: string): Promise<T | null> { return (this.m.get(k) as T) ?? null; }
  async set<T>(k: string, v: T): Promise<void> { this.m.set(k, v); }
  async delete(k: string): Promise<void> { this.m.delete(k); }
  async list(): Promise<string[]> { return Array.from(this.m.keys()); }
  async clear(): Promise<void> { this.m.clear(); }
}

const mockPlatform: IPlatform = {
  type: 'browser',
  capabilities: { filesystem: false, process: false, watch: false, mcpStdio: false, clipboard: false, notification: false, sandboxing: false, pty: false, documentPreview: false },
  fs: {} as any, process: {} as any, storage: new MemoryStorage(), search: {} as any,
};

const gitDiffDef: ToolDefinition = {
  name: 'git_diff', description: 'git diff',
  parameters: { type: 'object', properties: {} },
};
const noopExecutor: IToolExecutor = {
  execute: async (call: ToolCall): Promise<ToolResult> => ({ callId: call.id, output: 'diff' }),
};

function buildService() {
  const provider = new MockProvider();
  const registry = new ToolRegistry();
  registry.register(gitDiffDef, noopExecutor);
  const skillManager = new SkillManager();
  skillManager.register({
    name: 'code-review', description: 'review',
    triggerSignals: ['审查代码', '代码审查'],
    trigger: { type: 'implicit', patterns: ['审查代码'] },
    requiredTools: ['git_diff'],
  });
  const service = new ChatService();
  return { service, provider, skillManager, registry };
}

describe('ChatService skill_activated handling', () => {
  let service: ChatService;
  let provider: MockProvider;

  beforeEach(async () => {
    const ctx = buildService();
    service = ctx.service;
    provider = ctx.provider;
    await service.init(mockPlatform, {
      provider,
      model: 'test-model',
      toolRegistry: ctx.registry,
      capabilities: { skillManager: ctx.skillManager },
    });
    // Wait for startup session creation
    await new Promise((r) => setTimeout(r, 50));
  });

  it('sets activeSkills on the assistant message when a skill matches', async () => {
    provider.addResponse([
      { type: 'text_delta', text: 'reviewing' },
      { type: 'done', stopReason: 'stop' },
    ]);

    await service.sendMessage('请帮我做代码审查');
    // wait for the streaming + idle transition
    await new Promise((r) => setTimeout(r, 100));

    const assistant = service.messages.find((m) => m.role === 'assistant');
    expect(assistant).toBeDefined();
    expect(assistant!.activeSkills).toContain('code-review');
  });

  it('leaves activeSkills undefined when no skill matches', async () => {
    provider.addResponse([
      { type: 'text_delta', text: 'hi' },
      { type: 'done', stopReason: 'stop' },
    ]);

    await service.sendMessage('what is 2+2?');
    await new Promise((r) => setTimeout(r, 100));

    const assistant = service.messages.find((m) => m.role === 'assistant');
    expect(assistant).toBeDefined();
    expect(assistant!.activeSkills).toBeUndefined();
  });
});
