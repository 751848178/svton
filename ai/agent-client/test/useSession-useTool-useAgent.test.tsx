/**
 * useSession / useTool / useAgent hook tests.
 *
 * Verifies each hook correctly subscribes to its service's observable state
 * and exposes the expected action functions. Uses the HookProbe pattern
 * (same as useChat.test.tsx).
 */
import React, { useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { useChat } from '../src/hooks/useChat';
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

function makeTauriPlatform(): IPlatform {
  return {
    ...makePlatform(),
    type: 'tauri',
  } as IPlatform;
}

function HookProbe<T>({ hook, onState }: { hook: () => T; onState: (s: T) => void }) {
  const state = hook();
  useEffect(() => { onState(state); });
  return null;
}

type SessionAgentState = {
  session: ReturnType<typeof useSession>;
  agent: ReturnType<typeof useAgent>;
};

type ToolAgentState = {
  tool: ReturnType<typeof useToolApproval>;
  agent: ReturnType<typeof useAgent>;
};

type ChatAgentState = {
  chat: ReturnType<typeof useChat>;
  agent: ReturnType<typeof useAgent>;
};

function SessionAgentProbe({ onState }: { onState: (s: SessionAgentState) => void }) {
  const session = useSession();
  const agent = useAgent();
  useEffect(() => { onState({ session, agent }); });
  return null;
}

function ToolAgentProbe({ onState }: { onState: (s: ToolAgentState) => void }) {
  const tool = useToolApproval();
  const agent = useAgent();
  useEffect(() => { onState({ tool, agent }); });
  return null;
}

function ChatAgentProbe({ onState }: { onState: (s: ChatAgentState) => void }) {
  const chat = useChat();
  const agent = useAgent();
  useEffect(() => { onState({ chat, agent }); });
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
// useChat
// ============================================================
describe('useChat', () => {
  it('keeps streaming controls active while waiting for tool approval', async () => {
    let state: ChatAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <ChatAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state?.chat.status).toBe('idle'));
    expect(state!.chat.isStreaming).toBe(false);
    act(() => {
      state!.agent.chatService.status = 'waiting_approval';
    });

    await waitFor(() => expect(state?.chat.status).toBe('waiting_approval'));
    expect(state!.chat.isStreaming).toBe(true);
    unmount();
  });

  it('aborts an active approval wait before clearing chat from the hook', async () => {
    let state: ChatAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <ChatAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state?.chat.status).toBe('idle'));
    const abort = vi.spyOn(state!.agent.chatService, 'abort');
    act(() => {
      state!.agent.chatService.messages = [{
        id: 'msg-visible-clear-hook',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
        blocks: [{
          type: 'tool_call',
          call: {
            id: 'tc-visible-clear-hook',
            name: 'write_file',
            arguments: { path: '/tmp/hook.txt' },
            status: 'pending_approval',
          },
        }],
      }];
      state!.agent.chatService.status = 'waiting_approval';
    });

    await waitFor(() => expect(state?.chat.isStreaming).toBe(true));
    act(() => {
      state!.chat.clear();
    });

    expect(abort).toHaveBeenCalled();
    expect(state!.chat.messages).toEqual([]);
    expect(state!.chat.status).toBe('idle');
    unmount();
  });
});

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

  it('aborts a deleted background streaming session', async () => {
    let state: SessionAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <SessionAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state?.session.currentSessionId).toBeTruthy());
    const firstId = state!.session.currentSessionId!;
    state!.agent.chatService.messages = [
      { id: 'u1', role: 'user', content: 'keep running', timestamp: 1 },
      { id: 'a1', role: 'assistant', content: 'partial', isStreaming: true, timestamp: 2 },
    ];
    (state!.agent.chatService as any).status = 'running';
    (state!.agent.chatService as any).backgroundSessionId = firstId;
    const abortSpy = vi.spyOn(state!.agent.chatService, 'abort');

    await act(async () => {
      await state!.session.create('next');
    });
    expect(state!.session.currentSessionId).not.toBe(firstId);

    await act(async () => {
      await state!.session.delete(firstId);
    });

    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(state!.agent.chatService.isSessionStreaming(firstId)).toBe(false);
    expect(await state!.agent.sessionService.loadSession(firstId)).toBeNull();
    unmount();
  });

  it('saves finalized visible-only pending approvals before deleting the active session', async () => {
    let state: SessionAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <SessionAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state?.session.currentSessionId).toBeTruthy());
    const firstId = state!.session.currentSessionId!;
    state!.agent.chatService.messages = [{
      id: 'a-delete-visible',
      role: 'assistant',
      content: '',
      blocks: [{
        type: 'tool_call',
        call: {
          id: 'tc-delete-visible',
          name: 'test_tool',
          arguments: {},
          status: 'pending_approval',
        },
      }],
      isStreaming: true,
      timestamp: 1,
    }];
    (state!.agent.chatService as any).status = 'waiting_approval';
    const saveSpy = vi.spyOn(state!.agent.sessionService, 'saveSession');

    await act(async () => {
      await state!.session.delete(firstId);
    });

    expect(saveSpy).toHaveBeenCalled();
    const saved = saveSpy.mock.calls[0][0].messages as any[];
    expect(saved[0].blocks[0]).toMatchObject({
      type: 'tool_call',
      call: { id: 'tc-delete-visible', status: 'error' },
    });
    unmount();
  });

  it('keeps pending approvals when a waiting session is created into the background', async () => {
    let state: SessionAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <SessionAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state?.session.currentSessionId).toBeTruthy());
    const firstId = state!.session.currentSessionId!;
    state!.agent.chatService.messages = [
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'tc-bg', name: 'test_tool', arguments: {}, status: 'pending_approval' }],
        isStreaming: true,
        timestamp: 1,
      },
    ];
    (state!.agent.chatService as any).status = 'waiting_approval';
    (state!.agent.chatService as any).backgroundSessionId = firstId;
    (state!.agent.chatService as any).pendingToolCalls.set('tc-bg', {
      call: { id: 'tc-bg', name: 'test_tool', arguments: {} },
      resolve: vi.fn(),
    });

    await act(async () => {
      await state!.session.create('next');
    });

    expect(state!.agent.chatService.hasPendingApprovals).toBe(true);
    expect(state!.agent.chatService.isSessionStreaming(firstId)).toBe(true);
    unmount();
  });

  it('restores waiting status after creating away from a visible-only pending session', async () => {
    let state: SessionAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <SessionAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state?.session.currentSessionId).toBeTruthy());
    const firstId = state!.session.currentSessionId!;
    state!.agent.chatService.messages = [{
      id: 'a-visible-create',
      role: 'assistant',
      content: '',
      blocks: [{
        type: 'tool_call',
        call: {
          id: 'tc-visible-create',
          name: 'test_tool',
          arguments: {},
          status: 'pending_approval',
        },
      }],
      isStreaming: true,
      timestamp: 1,
    }];
    (state!.agent.chatService as any).status = 'waiting_approval';
    (state!.agent.chatService as any).backgroundSessionId = firstId;

    await act(async () => { await state!.session.create('next'); });
    expect(state!.session.currentSessionId).not.toBe(firstId);
    expect(state!.agent.chatService.isSessionStreaming(firstId)).toBe(true);

    await act(async () => { await state!.session.switchTo(firstId); });
    expect(state!.agent.chatService.status).toBe('waiting_approval');
    expect(state!.agent.chatService.messages[0].blocks?.[0]).toMatchObject({
      type: 'tool_call',
      call: { id: 'tc-visible-create', status: 'pending_approval' },
    });
    unmount();
  });

  it('keeps pending approvals when switching away from a waiting session', async () => {
    let state: SessionAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <SessionAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state?.session.currentSessionId).toBeTruthy());
    const firstId = state!.session.currentSessionId!;
    await act(async () => { await state!.session.create('second'); });
    const secondId = state!.session.currentSessionId!;
    await act(async () => { await state!.session.switchTo(firstId); });

    state!.agent.chatService.messages = [{
      id: 'a1',
      role: 'assistant',
      content: '',
      toolCalls: [{ id: 'tc-bg', name: 'test_tool', arguments: {}, status: 'pending_approval' }],
      isStreaming: true,
      timestamp: 1,
    }];
    (state!.agent.chatService as any).status = 'waiting_approval';
    (state!.agent.chatService as any).backgroundSessionId = firstId;
    (state!.agent.chatService as any).pendingToolCalls.set('tc-bg', {
      call: { id: 'tc-bg', name: 'test_tool', arguments: {} },
      resolve: vi.fn(),
    });

    await act(async () => { await state!.session.switchTo(secondId); });

    expect(state!.agent.chatService.hasPendingApprovals).toBe(true);
    expect(state!.agent.chatService.isSessionStreaming(firstId)).toBe(true);

    await act(async () => { await state!.session.switchTo(firstId); });
    expect(state!.agent.chatService.status).toBe('waiting_approval');
    unmount();
  });

  it('restores waiting status for visible-only pending approvals when switching back', async () => {
    let state: SessionAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <SessionAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state?.session.currentSessionId).toBeTruthy());
    const firstId = state!.session.currentSessionId!;
    await act(async () => { await state!.session.create('second'); });
    const secondId = state!.session.currentSessionId!;
    await act(async () => { await state!.session.switchTo(firstId); });

    state!.agent.chatService.messages = [{
      id: 'a-visible',
      role: 'assistant',
      content: '',
      blocks: [{
        type: 'tool_call',
        call: {
          id: 'tc-visible-bg',
          name: 'test_tool',
          arguments: {},
          status: 'pending_approval',
        },
      }],
      isStreaming: true,
      timestamp: 1,
    }];
    (state!.agent.chatService as any).status = 'waiting_approval';
    (state!.agent.chatService as any).backgroundSessionId = firstId;

    await act(async () => { await state!.session.switchTo(secondId); });
    expect(state!.agent.chatService.isSessionStreaming(firstId)).toBe(true);

    await act(async () => { await state!.session.switchTo(firstId); });
    expect(state!.agent.chatService.status).toBe('waiting_approval');
    expect(state!.agent.chatService.messages[0].blocks?.[0]).toMatchObject({
      type: 'tool_call',
      call: { id: 'tc-visible-bg', status: 'pending_approval' },
    });
    unmount();
  });

  it('restores running status when switching back to a background stream', async () => {
    let state: SessionAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <SessionAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state?.session.currentSessionId).toBeTruthy());
    const firstId = state!.session.currentSessionId!;
    await act(async () => { await state!.session.create('second'); });
    const secondId = state!.session.currentSessionId!;
    await act(async () => { await state!.session.switchTo(firstId); });

    state!.agent.chatService.messages = [
      { id: 'a1', role: 'assistant', content: 'partial', isStreaming: true, timestamp: 1 },
    ];
    (state!.agent.chatService as any).status = 'running';
    (state!.agent.chatService as any).backgroundSessionId = firstId;

    await act(async () => { await state!.session.switchTo(secondId); });
    expect(state!.agent.chatService.status).toBe('idle');

    await act(async () => { await state!.session.switchTo(firstId); });
    expect(state!.agent.chatService.status).toBe('running');
    unmount();
  });

  it('saves background cached messages during Tauri pagehide fallback', async () => {
    let state: SessionAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makeTauriPlatform()} config={makeConfig()}>
        <SessionAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state?.session.currentSessionId).toBeTruthy());
    const firstId = state!.session.currentSessionId!;
    state!.agent.chatService.messages = [
      { id: 'u1', role: 'user', content: 'background question', timestamp: 1 },
      { id: 'a1', role: 'assistant', content: 'partial answer', isStreaming: true, timestamp: 2 },
    ];
    (state!.agent.chatService as any).status = 'running';
    (state!.agent.chatService as any).backgroundSessionId = firstId;

    await act(async () => {
      await state!.session.create('active second');
    });
    expect(state!.session.currentSessionId).not.toBe(firstId);

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
      await Promise.resolve();
    });

    await waitFor(async () => {
      const saved = await state!.agent.sessionService.loadSession(firstId);
      expect(saved?.messages).toHaveLength(2);
      expect((saved!.messages[1] as any).content).toBe('partial answer');
    });
    const saved = await state!.agent.sessionService.loadSession(firstId);
    expect((saved!.messages[1] as any).isStreaming).toBeUndefined();
    unmount();
  });

  it('keeps background pending approvals when creating from another idle session', async () => {
    let state: SessionAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <SessionAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state?.session.currentSessionId).toBeTruthy());
    const firstId = state!.session.currentSessionId!;
    await act(async () => { await state!.session.create('second'); });

    (state!.agent.chatService as any).backgroundSessionId = firstId;
    (state!.agent.chatService as any).pendingToolCalls.set('tc-bg', {
      call: { id: 'tc-bg', name: 'test_tool', arguments: {} },
      resolve: vi.fn(),
    });

    await act(async () => { await state!.session.create('third'); });

    expect(state!.agent.chatService.hasPendingApprovals).toBe(true);
    expect(state!.agent.chatService.isSessionStreaming(firstId)).toBe(true);
    unmount();
  });

  it('keeps background pending approvals when switching between other idle sessions', async () => {
    let state: SessionAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <SessionAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state?.session.currentSessionId).toBeTruthy());
    const firstId = state!.session.currentSessionId!;
    await act(async () => { await state!.session.create('second'); });
    const secondId = state!.session.currentSessionId!;
    await act(async () => { await state!.session.create('third'); });
    const thirdId = state!.session.currentSessionId!;
    await act(async () => { await state!.session.switchTo(secondId); });

    (state!.agent.chatService as any).backgroundSessionId = firstId;
    (state!.agent.chatService as any).pendingToolCalls.set('tc-bg', {
      call: { id: 'tc-bg', name: 'test_tool', arguments: {} },
      resolve: vi.fn(),
    });

    await act(async () => { await state!.session.switchTo(thirdId); });

    expect(state!.agent.chatService.hasPendingApprovals).toBe(true);
    expect(state!.agent.chatService.isSessionStreaming(firstId)).toBe(true);
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

  it('lists preserved background pending approvals', async () => {
    let state: ToolAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <ToolAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state).not.toBeNull());
    act(() => {
      (state!.agent.chatService as any).pendingToolCalls.set('tc-bg', {
        call: { id: 'tc-bg', name: 'test_tool', arguments: { key: 'value' } },
        resolve: vi.fn(),
      });
      state!.agent.chatService.messages = [];
    });

    await waitFor(() => expect(state!.tool.hasPending).toBe(true));
    expect(state!.tool.pendingCalls).toEqual([
      { id: 'tc-bg', name: 'test_tool', arguments: { key: 'value' }, status: 'pending_approval' },
    ]);
    unmount();
  });

  it('lists visible block-based pending approvals', async () => {
    let state: ToolAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <ToolAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state).not.toBeNull());
    act(() => {
      state!.agent.chatService.messages = [{
        id: 'assistant-block',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        blocks: [{
          type: 'tool_call',
          call: {
            id: 'tc-block',
            name: 'write_file',
            arguments: { path: '/tmp/out.txt' },
            status: 'pending_approval',
          },
        }],
      }];
    });

    await waitFor(() => expect(state!.tool.pendingCalls).toEqual([
      {
        id: 'tc-block',
        name: 'write_file',
        arguments: { path: '/tmp/out.txt' },
        status: 'pending_approval',
      },
    ]));
    expect(state!.tool.hasPending).toBe(true);
    unmount();
  });

  it('prefers block pending approval metadata over stale legacy toolCalls', async () => {
    let state: ToolAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <ToolAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state).not.toBeNull());
    act(() => {
      state!.agent.chatService.messages = [{
        id: 'assistant-block',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{
          id: 'tc-shared',
          name: 'write_file',
          arguments: { path: '/tmp/out.txt' },
          status: 'pending_approval',
        }],
        blocks: [{
          type: 'tool_call',
          call: {
            id: 'tc-shared',
            name: 'write_file',
            arguments: { path: '/tmp/out.txt' },
            metadata: {
              autoReviewVerdict: {
                verdict: 'ask_user',
                reason: 'No matching rule',
              },
            },
            status: 'pending_approval',
          },
        }],
      }];
    });

    await waitFor(() => expect(state!.tool.pendingCalls).toEqual([
      {
        id: 'tc-shared',
        name: 'write_file',
        arguments: { path: '/tmp/out.txt' },
        metadata: {
          autoReviewVerdict: {
            verdict: 'ask_user',
            reason: 'No matching rule',
          },
        },
        status: 'pending_approval',
      },
    ]));
    unmount();
  });

  it('prefers block pending approval metadata over stale legacy toolCalls across messages', async () => {
    let state: ToolAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <ToolAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state).not.toBeNull());
    act(() => {
      state!.agent.chatService.messages = [
        {
          id: 'assistant-old',
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          toolCalls: [{
            id: 'tc-cross-message',
            name: 'write_file',
            arguments: { path: '/tmp/legacy.txt' },
            status: 'pending_approval',
          }],
        },
        {
          id: 'assistant-new',
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          blocks: [{
            type: 'tool_call',
            call: {
              id: 'tc-cross-message',
              name: 'write_file',
              arguments: { path: '/tmp/out.txt' },
              metadata: {
                autoReviewVerdict: {
                  verdict: 'ask_user',
                  reason: 'No matching rule',
                },
              },
              status: 'pending_approval',
            },
          }],
        },
      ];
    });

    await waitFor(() => expect(state!.tool.pendingCalls).toEqual([
      {
        id: 'tc-cross-message',
        name: 'write_file',
        arguments: { path: '/tmp/out.txt' },
        metadata: {
          autoReviewVerdict: {
            verdict: 'ask_user',
            reason: 'No matching rule',
          },
        },
        status: 'pending_approval',
      },
    ]));
    unmount();
  });

  it('dedupes visible block approvals against runtime pending calls', async () => {
    let state: ToolAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <ToolAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state).not.toBeNull());
    act(() => {
      state!.agent.chatService.messages = [{
        id: 'assistant-block',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        blocks: [{
          type: 'tool_call',
          call: {
            id: 'tc-shared',
            name: 'visible_tool',
            arguments: { visible: true },
            status: 'pending_approval',
          },
        }],
      }];
      (state!.agent.chatService as any).pendingToolCalls.set('tc-shared', {
        call: { id: 'tc-shared', name: 'runtime_tool', arguments: { runtime: true } },
        resolve: vi.fn(),
      });
      (state!.agent.chatService as any).bumpPendingApprovals();
    });

    await waitFor(() => expect(state!.tool.pendingCalls).toEqual([
      {
        id: 'tc-shared',
        name: 'visible_tool',
        arguments: { visible: true },
        status: 'pending_approval',
      },
    ]));
    unmount();
  });

  it('uses runtime pending metadata when visible legacy pending call is stale', async () => {
    let state: ToolAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <ToolAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state).not.toBeNull());
    act(() => {
      state!.agent.chatService.messages = [{
        id: 'assistant-legacy',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{
          id: 'tc-runtime-meta',
          name: 'write_file',
          arguments: { path: '/tmp/legacy.txt' },
          status: 'pending_approval',
        }],
      }];
      (state!.agent.chatService as any).pendingToolCalls.set('tc-runtime-meta', {
        call: { id: 'tc-runtime-meta', name: 'write_file', arguments: { path: '/tmp/out.txt' } },
        metadata: {
          autoReviewVerdict: {
            verdict: 'ask_user',
            reason: 'No matching rule',
          },
        },
        resolve: vi.fn(),
      });
      (state!.agent.chatService as any).bumpPendingApprovals();
    });

    await waitFor(() => expect(state!.tool.pendingCalls).toEqual([
      {
        id: 'tc-runtime-meta',
        name: 'write_file',
        arguments: { path: '/tmp/out.txt' },
        metadata: {
          autoReviewVerdict: {
            verdict: 'ask_user',
            reason: 'No matching rule',
          },
        },
        status: 'pending_approval',
      },
    ]));
    unmount();
  });

  it('reacts when runtime pending approvals change without visible messages changing', async () => {
    let state: ToolAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <ToolAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state).not.toBeNull());
    act(() => {
      (state!.agent.chatService as any).pendingToolCalls.set('tc-bg', {
        call: { id: 'tc-bg', name: 'test_tool', arguments: {} },
        resolve: vi.fn(),
      });
      (state!.agent.chatService as any).bumpPendingApprovals();
    });

    await waitFor(() => expect(state!.tool.pendingCalls).toHaveLength(1));
    act(() => {
      state!.tool.approve('tc-bg');
    });
    await waitFor(() => expect(state!.tool.pendingCalls).toHaveLength(0));
    unmount();
  });

  it('clears visible-only pending approval state after approving or rejecting', async () => {
    let state: ToolAgentState | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <ToolAgentProbe onState={(s) => { state = s; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state).not.toBeNull());
    act(() => {
      state!.agent.chatService.messages = [{
        id: 'assistant-visible-approve',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        blocks: [{
          type: 'tool_call',
          call: {
            id: 'tc-visible-approve',
            name: 'write_file',
            arguments: { path: '/tmp/approve.txt' },
            status: 'pending_approval',
          },
        }],
      }];
    });

    await waitFor(() => expect(state!.tool.pendingCalls).toHaveLength(1));
    act(() => {
      state!.tool.approve('tc-visible-approve');
    });

    await waitFor(() => expect(state!.tool.pendingCalls).toHaveLength(0));
    expect(state!.agent.chatService.messages[0].blocks?.[0]).toMatchObject({
      type: 'tool_call',
      call: { id: 'tc-visible-approve', status: 'running' },
    });

    act(() => {
      state!.agent.chatService.messages = [{
        id: 'assistant-visible-reject',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        blocks: [{
          type: 'tool_call',
          call: {
            id: 'tc-visible-reject',
            name: 'write_file',
            arguments: { path: '/tmp/reject.txt' },
            status: 'pending_approval',
          },
        }],
      }];
    });

    await waitFor(() => expect(state!.tool.pendingCalls).toHaveLength(1));
    act(() => {
      state!.tool.reject('tc-visible-reject');
    });

    await waitFor(() => expect(state!.tool.pendingCalls).toHaveLength(0));
    expect(state!.agent.chatService.messages[0].blocks?.[0]).toMatchObject({
      type: 'tool_call',
      call: { id: 'tc-visible-reject', status: 'error' },
    });
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

  it('updates isConnected when pending approvals change without visible messages changing', async () => {
    const rendered = await renderWith(() => useAgent());
    expect(rendered.state.isConnected).toBe(false);

    act(() => {
      (rendered.state.chatService as any).pendingToolCalls.set('tc-bg', {
        call: { id: 'tc-bg', name: 'test_tool', arguments: {} },
        resolve: vi.fn(),
      });
      (rendered.state.chatService as any).bumpPendingApprovals();
    });

    await waitFor(() => expect(rendered.state.isConnected).toBe(true));
    act(() => {
      rendered.state.chatService.approveToolCall('tc-bg');
    });
    await waitFor(() => expect(rendered.state.isConnected).toBe(false));
    rendered.unmount();
  });

  it('keeps isConnected true for visible-only pending approvals', async () => {
    const rendered = await renderWith(() => useAgent());
    expect(rendered.state.isConnected).toBe(false);

    act(() => {
      rendered.state.chatService.messages = [{
        id: 'assistant-visible-pending',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        blocks: [{
          type: 'tool_call',
          call: {
            id: 'tc-visible-agent',
            name: 'write_file',
            arguments: { path: '/tmp/out.txt' },
            status: 'pending_approval',
          },
        }],
      }];
    });

    await waitFor(() => expect(rendered.state.isConnected).toBe(true));
    act(() => {
      rendered.state.chatService.approveToolCall('tc-visible-agent');
    });
    await waitFor(() => expect(rendered.state.isConnected).toBe(false));
    rendered.unmount();
  });
});
