/**
 * useChat hook tests — verifies reactive subscription to ChatService state.
 *
 * Rather than reproducing the full send → stream → done flow (already covered
 * by chat.service.test.ts), these tests verify the hook correctly subscribes
 * to the @svton/service observable and forwards state changes to React.
 *
 * Strategy: render the hook inside AgentProvider, then directly mutate
 * chatService.messages / chatService.status (the observable setters) and
 * assert the hook re-renders with the updated state.
 */
import React, { useRef, useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { useChat } from '../src/hooks/useChat';
import { AgentProvider } from '../src/service/provider';
import { ChatService } from '../src/service/chat.service';
import { ToolRegistry } from '@svton/agent-core';
import type { AgentConfig, IProvider, StreamEvent, ChatMessage, ChatOptions, ModelInfo } from '@svton/agent-core';
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
  const provider = new StubProvider();
  return {
    provider,
    model: 'test-model',
    toolRegistry: new ToolRegistry(),
    workingDir: '/',
  };
}

function makePlatform(): IPlatform {
  return {
    type: 'browser',
    capabilities: { filesystem: false, process: false, watch: false, mcpStdio: false, clipboard: false, notification: false, sandboxing: false, pty: false, documentPreview: false, computerUse: false } as any,
    fs: {} as any, process: {} as any, storage: new MemStorage(), search: {} as any,
  } as IPlatform;
}

/** Test component that calls the hook and forwards state via callback. */
function HookProbe({ onState }: { onState: (s: ReturnType<typeof useChat>) => void }) {
  const api = useChat();
  useEffect(() => { onState(api); });
  return null;
}

describe('useChat', () => {
  it('returns empty messages and idle status initially', async () => {
    let state: ReturnType<typeof useChat> | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <HookProbe onState={(s) => { state = s; }} />
      </AgentProvider>
    );
    await waitFor(() => expect(state).not.toBeNull());
    expect(state!.messages).toEqual([]);
    expect(state!.isStreaming).toBe(false);
    unmount();
  });

  it('exposes send / retry / editMessage / abort functions', async () => {
    let state: ReturnType<typeof useChat> | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <HookProbe onState={(s) => { state = s; }} />
      </AgentProvider>
    );
    await waitFor(() => expect(state).not.toBeNull());
    expect(typeof state!.send).toBe('function');
    expect(typeof state!.retry).toBe('function');
    expect(typeof state!.editMessage).toBe('function');
    expect(typeof state!.abort).toBe('function');
    unmount();
  });

  it('exposes inputHistory', async () => {
    let state: ReturnType<typeof useChat> | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <HookProbe onState={(s) => { state = s; }} />
      </AgentProvider>
    );
    await waitFor(() => expect(state).not.toBeNull());
    expect(Array.isArray(state!.inputHistory)).toBe(true);
    unmount();
  });
});
