/**
 * useSession / useTool / useAgent hook tests.
 *
 * Verifies each hook correctly subscribes to its service's observable state
 * and exposes the expected action functions. Uses the HookProbe pattern
 * (same as useChat.test.tsx).
 */
import React, { useEffect } from 'react';
import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { useSession } from '../src/hooks/useSession';
import { useToolApproval } from '../src/hooks/useTool';
import { useAgent } from '../src/hooks/useAgent';
import { AgentProvider } from '../src/service/provider';
import { ToolRegistry } from '@svton/agent-core';
import type { AgentConfig, IProvider, StreamEvent, ModelInfo } from '@svton/agent-core';
import type { IPlatform, IStorage } from '@svton/agent-platform';

class StubProvider implements IProvider {
  readonly name = 'mock';
  readonly models: ModelInfo[] = [{ id: 'test-model', name: 'Test', contextWindow: 128000, supportsToolUse: true, supportsVision: false, supportsStreaming: true }];
  async *chat(): AsyncGenerator<StreamEvent> {}
  countTokens(t: string): number { return Math.ceil(t.length / 4); }
  supportsToolUse(): boolean { return true; }
  supportsVision(): boolean { return false; }
}

class MemStorage implements IStorage {
  private m = new Map<string, unknown>();
  async get<T>(k: string): Promise<T | null> { return (this.m.get(k) as T) ?? null; }
  async set<T>(k: string, v: T): Promise<void> { this.m.set(k, v); }
  async delete(k: string): Promise<void> { this.m.delete(k); }
  async list(): Promise<string[]> { return Array.from(this.m.keys()); }
  async clear(): Promise<void> { this.m.clear(); }
}

function makeConfig(): AgentConfig {
  return { provider: new StubProvider(), model: 'test-model', toolRegistry: new ToolRegistry(), workingDir: '/' };
}

function makePlatform(): IPlatform {
  return {
    type: 'browser',
    capabilities: { filesystem: false, process: false, watch: false, mcpStdio: false, clipboard: false, notification: false, sandboxing: false, pty: false, documentPreview: false, computerUse: false } as any,
    fs: {} as any, process: {} as any, storage: new MemStorage(), search: {} as any,
  } as IPlatform;
}

function HookProbe<T>({ hook, onState }: { hook: () => T; onState: (s: T) => void }) {
  const state = hook();
  useEffect(() => { onState(state); });
  return null;
}

function renderWith<T>(hook: () => T): Promise<{ state: T; unmount: () => void }> {
  let state: T | null = null;
  const { unmount } = render(
    <AgentProvider platform={makePlatform()} config={makeConfig()}>
      <HookProbe hook={hook} onState={(s: T) => { state = s; }} />
    </AgentProvider>
  );
  return waitFor(() => expect(state).not.toBeNull()).then(() => ({ get state() { return state!; }, unmount }));
}

// ============================================================
// useSession
// ============================================================
describe('useSession', () => {
  it('exposes sessions list + currentSessionId', async () => {
    const { state, unmount } = await renderWith(() => useSession());
    expect(Array.isArray(state.sessions)).toBe(true);
    expect(state.currentSessionId === null || typeof state.currentSessionId === 'string').toBe(true);
    unmount();
  });

  it('exposes create / switchTo / delete / flush actions', async () => {
    const { state, unmount } = await renderWith(() => useSession());
    expect(typeof state.create).toBe('function');
    expect(typeof state.switchTo).toBe('function');
    expect(typeof state.delete).toBe('function');
    expect(typeof state.flush).toBe('function');
    unmount();
  });

  it('exposes saveSessionMessages and updateProjectId', async () => {
    const { state, unmount } = await renderWith(() => useSession());
    expect(typeof state.saveSessionMessages).toBe('function');
    expect(typeof state.updateProjectId).toBe('function');
    unmount();
  });
});

// ============================================================
// useToolApproval
// ============================================================
describe('useToolApproval', () => {
  it('exposes approve and reject functions', async () => {
    const { state, unmount } = await renderWith(() => useToolApproval());
    expect(typeof state.approve).toBe('function');
    expect(typeof state.reject).toBe('function');
    unmount();
  });
});

// ============================================================
// useAgent
// ============================================================
describe('useAgent', () => {
  it('exposes platform and services', async () => {
    const { state, unmount } = await renderWith(() => useAgent());
    expect(state.platform).toBeDefined();
    expect(state.chatService).toBeDefined();
    expect(state.sessionService).toBeDefined();
    unmount();
  });

  it('exposes isConnected boolean', async () => {
    const { state, unmount } = await renderWith(() => useAgent());
    expect(typeof state.isConnected).toBe('boolean');
    unmount();
  });
});
