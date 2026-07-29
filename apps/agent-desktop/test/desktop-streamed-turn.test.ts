/**
 * PI010-R1 — Desktop/Tauri real product-path E2E.
 *
 * Goal gap: "验证 Desktop/Tauri 可执行的真实产品路径". The existing Desktop tests
 * cover tool registration and config wiring but NONE drive a real Pi-runtime
 * streamed turn from the Desktop entrypoint. This test wires the REAL Desktop
 * path (initAgent → AgentConfig → ChatService → SvtonAgentRuntime.run → tool
 * execution → platform) end-to-end.
 *
 * The Desktop config builder (initAgent) is invoked for real (only disk/config
 * is mocked), producing a genuine Pi-backed AgentConfig. The Pi Models are then
 * swapped for a fauxProvider-backed mock so no network/API key is needed. A
 * shell tool call verifies the platform execution path resolves to the Desktop
 * platform's `process.exec` (the Tauri sandbox abstraction seam), proving the
 * Desktop-specific wiring reaches the shared ToolExecutionService pipeline.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'reflect-metadata';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }));

const mockConfig = {
  model: { name: 'claude-sonnet-4-20250514', provider: 'anthropic' },
  providers: {
    anthropic: {
      type: 'anthropic' as const,
      base_url: 'https://api.anthropic.com',
      api_key: 'sk-ant-test',
      models: { 'claude-sonnet-4-20250514': 'Claude Sonnet 4' },
    },
  },
};
vi.mock('@/lib/config-store', () => ({
  loadConfig: vi.fn(async () => ({ config: mockConfig })),
  saveConfig: vi.fn(async () => {}),
  openConfigInEditor: vi.fn(async () => {}),
  getConfigPath: vi.fn(async () => '/home/test/.svton/config.toml'),
}));

import { initAgent } from '../src/lib/agent-setup';
import { ChatService } from '@svton/agent-client';
import { PermissionManager } from '@svton/agent-core';
import {
  createMockModels,
  fauxAssistantMessage,
  fauxText,
  fauxToolCall,
} from '../../../ai/agent-core/test/helpers';
import type { TauriPlatform, IStorage } from '@svton/agent-platform';

class MemoryStorage implements IStorage {
  private m = new Map<string, unknown>();
  async get<T>(k: string): Promise<T | null> { return (this.m.get(k) as T) ?? null; }
  async set<T>(k: string, v: T): Promise<void> { this.m.set(k, v); }
  async delete(k: string): Promise<void> { this.m.delete(k); }
  async list(): Promise<string[]> { return Array.from(this.m.keys()); }
  async clear(): Promise<void> { this.m.clear(); }
}

/** A Tauri-shaped platform whose `process.exec` records invocations. */
function makeRecordingPlatform(storage: MemoryStorage): TauriPlatform & { execCalls: string[] } {
  const execCalls: string[] = [];
  return {
    type: 'tauri',
    capabilities: {
      filesystem: true, process: true, watch: false, mcpStdio: false,
      clipboard: false, notification: false, sandboxing: false, pty: false, documentPreview: false,
    },
    fs: {
      exists: async () => false, readFile: async () => '', writeFile: async () => {},
      deleteFile: async () => {},
      stat: async () => ({ isFile: true, isDirectory: false, size: 0, mtime: 0 }),
      listDir: async () => [], resolve: (p: string) => p,
      join: (...s: string[]) => s.join('/'), watch: () => () => {},
    } as any,
    process: {
      exec: async (cmd: string | string[]) => {
        execCalls.push(typeof cmd === 'string' ? cmd : cmd.join(' '));
        return { stdout: 'desktop-exec-result', stderr: '', exitCode: 0, timedOut: false };
      },
      getEnv: (k: string) => (k === 'HOME' ? '/home/test' : ''),
      getCwd: () => '/home/test',
      spawn: () => ({ pid: 1, kill: () => {}, on: () => {} }),
    } as any,
    storage,
    search: { grep: async () => [], glob: async () => [] } as any,
    http: { request: async () => { throw new Error('not used'); } } as any,
    execCalls,
  } as any;
}

describe('Desktop product-path E2E (initAgent → ChatService → Pi runtime → platform)', () => {
  let storage: MemoryStorage;

  beforeEach(() => { storage = new MemoryStorage(); });

  it('initAgent produces a Pi-backed config that drives a real streamed turn', async () => {
    // 1. Real Desktop wiring: initAgent builds the config (tools + Pi models).
    const platform = makeRecordingPlatform(storage);
    const result = await initAgent(platform as TauriPlatform);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    const desktopConfig = result.config;

    // 2. Swap real Pi Models for a fauxProvider-backed mock (no network/key).
    const mock = createMockModels('claude-sonnet-4-20250514');
    mock.addResponse(fauxAssistantMessage([fauxText('Hello from desktop Pi runtime')]));
    const scriptedConfig = { ...desktopConfig, models: mock.models, piModel: mock.model };

    // 3. Drive a real streamed turn through ChatService (the product path).
    const service = new ChatService();
    await service.init(platform as unknown as never, scriptedConfig);
    await service.sendMessage('hi');

    const assistant = service.messages.find((m) => m.role === 'assistant');
    const text = typeof assistant?.content === 'string' ? assistant.content : '';
    expect(text).toBe('Hello from desktop Pi runtime');
    expect(service.status).toBe('idle');
  });

  it('a shell tool call reaches the Desktop platform process.exec (platform-execution seam)', async () => {
    const platform = makeRecordingPlatform(storage);
    const result = await initAgent(platform as TauriPlatform);
    if (result.kind !== 'ready') throw new Error('initAgent not ready');
    const desktopConfig = result.config;

    const mock = createMockModels('claude-sonnet-4-20250514');
    // Turn 1: the model calls the shell tool; turn 2: it answers.
    mock.addResponse(fauxAssistantMessage([fauxToolCall('bash', { command: 'echo hello' })]));
    mock.addResponse(fauxAssistantMessage([fauxText('done')]));
    // Auto-approve the destructive shell tool so the turn completes without a
    // user-approval pause (the approval gate itself is covered in agent-core).
    const capabilities = { ...(desktopConfig.capabilities ?? {}), permissionManager: new PermissionManager({ mode: 'auto' }) };
    const scriptedConfig = { ...desktopConfig, models: mock.models, piModel: mock.model, capabilities };

    const service = new ChatService();
    await service.init(platform as unknown as never, scriptedConfig);
    await service.sendMessage('run echo');

    // The shell tool must have executed via the Desktop platform's process.exec.
    const ran = platform.execCalls.some((c) => c.includes('echo'));
    expect(ran).toBe(true);
    expect(service.status).toBe('idle');
  });
});
