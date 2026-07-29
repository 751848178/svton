import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IStorage } from '@svton/agent-platform';
import { AgentProvider, useAgentContext } from '../src/service/provider';
import { ChatService } from '../src/service/chat.service';
import { restoreMessagesIntoRuntime } from '../src/service/chat-runtime-bridge';
import { useSession } from '../src/hooks/useSession';
import { buildPiAgentConfig, makeBrowserPlatform } from './helpers/pi-test-utils';

class DelayedStorage implements IStorage {
  private readonly values = new Map<string, unknown>();
  private readonly delays = new Map<string, number>();

  delayGet(key: string, milliseconds: number): void {
    this.delays.set(key, milliseconds);
  }

  async get<T>(key: string): Promise<T | null> {
    const delay = this.delays.get(key) ?? 0;
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    return (this.values.get(key) as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    return [...this.values.keys()].filter((key) => !prefix || key.startsWith(prefix));
  }

  async clear(): Promise<void> {
    this.values.clear();
  }
}

type ProbeState = {
  session: ReturnType<typeof useSession>;
  chat: ChatService;
};

function SessionProbe({ onState }: { onState: (state: ProbeState) => void }) {
  const session = useSession();
  const { chatService } = useAgentContext();
  useEffect(() => onState({ session, chat: chatService }));
  return null;
}

function storedSession(id: string, content: string, updatedAt: number) {
  return {
    id,
    title: id,
    model: 'test-model',
    messages: [{ role: 'user', content }],
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('session isolation', () => {
  it('falls back to the selected display transcript when checkpoint loading fails', async () => {
    const setMessages = vi.fn();
    const runtime = {
      getResumeManager: () => ({
        load: vi.fn().mockRejectedValue(new Error('broken checkpoint')),
      }),
      setMessages,
    } as unknown as Parameters<typeof restoreMessagesIntoRuntime>[0];

    await expect(restoreMessagesIntoRuntime(
      runtime,
      'session-b',
      [{ id: 'b', role: 'user', content: 'ONLY_B', timestamp: 1 }],
    )).resolves.toBe(true);
    expect(setMessages).toHaveBeenCalledWith([{ role: 'user', content: 'ONLY_B' }]);
  });

  it('clears runtime context when an empty session is activated', async () => {
    const storage = new DelayedStorage();
    const platform = makeBrowserPlatform(storage);
    const { config } = buildPiAgentConfig();
    const service = new ChatService();
    await service.init(platform, config);
    const runtime = (service as unknown as { runtime: { getMessages(): unknown[]; setMessages(messages: unknown[]): void } }).runtime;

    runtime.setMessages([{ role: 'user', content: 'SESSION_A_SECRET' }]);
    service.bindSession('session-a');
    service.bindSession('session-b');
    await service.loadMessages([]);

    expect(runtime.getMessages()).toEqual([]);
  });

  it('does not start a second turn while another session owns the runtime stream', async () => {
    const storage = new DelayedStorage();
    const platform = makeBrowserPlatform(storage);
    const { config } = buildPiAgentConfig();
    const service = new ChatService();
    await service.init(platform, config);
    service.bindSession('session-a');
    (service as unknown as { backgroundSessionId: string | null }).backgroundSessionId = 'session-a';
    service.bindSession('session-b');
    service.status = 'idle';

    const runtime = (service as unknown as { runtime: { run: (...args: unknown[]) => AsyncGenerator<unknown> } }).runtime;
    const run = vi.spyOn(runtime, 'run').mockImplementation(async function* () {
      yield { type: 'done', stopReason: 'stop' };
    });

    await service.sendMessage('SESSION_B_MESSAGE');

    expect(run).not.toHaveBeenCalled();
    expect(service.messages).toEqual([]);
  });

  it('keeps the latest requested session content after rapid async switches', async () => {
    const storage = new DelayedStorage();
    const sessions = [
      { id: 'session-a', title: 'A', model: 'test-model', messageCount: 1, createdAt: 1, updatedAt: 1 },
      { id: 'session-b', title: 'B', model: 'test-model', messageCount: 1, createdAt: 2, updatedAt: 2 },
      { id: 'session-c', title: 'C', model: 'test-model', messageCount: 1, createdAt: 3, updatedAt: 3 },
    ];
    await storage.set('agent:session_list', sessions);
    await storage.set('agent:session:session-a', storedSession('session-a', 'ONLY_A', 1));
    await storage.set('agent:session:session-b', storedSession('session-b', 'ONLY_B', 2));
    await storage.set('agent:session:session-c', storedSession('session-c', 'ONLY_C', 3));
    storage.delayGet('agent:session:session-b', 40);

    const platform = makeBrowserPlatform(storage);
    const { config } = buildPiAgentConfig();
    let state: ProbeState | null = null;
    const view = render(
      <AgentProvider platform={platform} config={config}>
        <SessionProbe onState={(next) => { state = next; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state?.session.currentSessionId).toBe('session-a'));
    await waitFor(() => expect(state?.chat.messages[0]?.content).toBe('ONLY_A'));

    await act(async () => {
      await Promise.all([
        state!.session.switchTo('session-b'),
        state!.session.switchTo('session-c'),
      ]);
    });

    await waitFor(() => expect(state?.session.currentSessionId).toBe('session-c'));
    expect(state!.chat.activeSessionId).toBe('session-c');
    expect(state!.chat.messages.map((message) => message.content)).toEqual(['ONLY_C']);
    view.unmount();
  });

  it('opens the explicitly requested popout session instead of the newest session', async () => {
    const storage = new DelayedStorage();
    const sessions = [
      { id: 'session-a', title: 'A', model: 'test-model', messageCount: 1, createdAt: 1, updatedAt: 2 },
      { id: 'session-b', title: 'B', model: 'test-model', messageCount: 1, createdAt: 1, updatedAt: 1 },
    ];
    await storage.set('agent:session_list', sessions);
    await storage.set('agent:session:session-a', storedSession('session-a', 'ONLY_A', 2));
    await storage.set('agent:session:session-b', storedSession('session-b', 'ONLY_B', 1));
    const platform = makeBrowserPlatform(storage);
    const { config } = buildPiAgentConfig();
    let state: ProbeState | null = null;
    const view = render(
      <AgentProvider
        platform={platform}
        config={config}
        initialSessionId="session-b"
      >
        <SessionProbe onState={(next) => { state = next; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state?.session.currentSessionId).toBe('session-b'));
    await waitFor(() => expect(state?.chat.messages[0]?.content).toBe('ONLY_B'));
    view.unmount();
  });
});
