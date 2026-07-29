import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IStorage } from '@svton/agent-platform';
import { SessionResumeManager } from '@svton/agent-core';
import { AgentProvider, useAgentContext } from '../src/service/provider';
import { ChatService } from '../src/service/chat.service';
import { restoreMessagesIntoRuntime } from '../src/service/chat-runtime-bridge';
import { piMessagesToDisplay } from '../src/service/pi-message-display-boundary.utils';
import { useSession } from '../src/hooks/useSession';
import {
  buildPiAgentConfig,
  EventScripter,
  fauxAssistantMessage,
  fauxText,
  makeBrowserPlatform,
  nativeAssistantLifecycle,
  nativeTextDelta,
} from './helpers/pi-test-utils';

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
  it('projects canonical timestamps and provider/tool metadata without regeneration', () => {
    const assistant = fauxAssistantMessage([
      { type: 'text', text: 'answer', textSignature: 'text-signature' },
      {
        type: 'thinking',
        thinking: 'reasoning',
        thinkingSignature: 'thinking-signature',
        redacted: false,
      },
      {
        type: 'toolCall',
        id: 'call-1',
        name: 'search',
        arguments: { query: 'pi' },
        thoughtSignature: 'tool-signature',
      },
    ]);
    assistant.timestamp = 22;
    assistant.responseModel = 'response-model';
    assistant.responseId = 'response-id';
    const display = piMessagesToDisplay([
      { role: 'user', content: 'question', timestamp: 11 },
      assistant,
      {
        role: 'toolResult',
        toolCallId: 'call-1',
        toolName: 'search',
        content: [{ type: 'image', data: 'image-data', mimeType: 'image/png' }],
        details: { source: 'fixture' },
        usage: assistant.usage,
        addedToolNames: ['follow_up'],
        isError: false,
        timestamp: 33,
      },
    ]);

    expect(display.map((message) => message.timestamp)).toEqual([11, 22]);
    expect(display[1].metadata).toMatchObject({
      api: assistant.api,
      provider: assistant.provider,
      model: assistant.model,
      responseModel: 'response-model',
      responseId: 'response-id',
      usage: assistant.usage,
    });
    expect(display[1].blocks).toContainEqual({
      type: 'text',
      text: 'answer',
      textSignature: 'text-signature',
    });
    expect(display[1].toolCalls?.[0]).toMatchObject({
      metadata: { thoughtSignature: 'tool-signature' },
      result: {
        metadata: {
          toolName: 'search',
          details: { source: 'fixture' },
          usage: assistant.usage,
          addedToolNames: ['follow_up'],
          timestamp: 33,
        },
      },
    });
  });

  it('clears canonical state instead of synthesizing it from display when checkpoint loading fails', async () => {
    const setMessages = vi.fn();
    const reset = vi.fn();
    const runtime = {
      getResumeManager: () => ({
        load: vi.fn().mockRejectedValue(new Error('broken checkpoint')),
      }),
      setMessages,
      reset,
    } as unknown as Parameters<typeof restoreMessagesIntoRuntime>[0];

    await expect(restoreMessagesIntoRuntime(
      runtime,
      'session-b',
    )).resolves.toBe('empty');
    expect(setMessages).not.toHaveBeenCalled();
    expect(reset).toHaveBeenCalledOnce();
  });

  it('clears runtime and stale display history when no canonical checkpoint exists', async () => {
    const storage = new DelayedStorage();
    const platform = makeBrowserPlatform(storage);
    const { config } = buildPiAgentConfig();
    const service = new ChatService();
    await service.init(platform, config);
    const runtime = (service as unknown as { runtime: { getMessages(): unknown[]; setMessages(messages: unknown[]): void } }).runtime;

    runtime.setMessages([{ role: 'user', content: 'SESSION_A_SECRET' }]);
    service.bindSession('session-a');
    service.bindSession('session-b');
    await service.loadMessages([
      { id: 'stale', role: 'user', content: 'STALE_DISPLAY_ONLY', timestamp: 1 },
    ]);

    expect(runtime.getMessages()).toEqual([]);
    expect(service.messages).toEqual([]);
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
    const run = vi.spyOn(runtime, 'run').mockImplementation(async function* () {});

    await service.sendMessage('SESSION_B_MESSAGE');

    expect(run).not.toHaveBeenCalled();
    expect(service.messages).toEqual([]);
  });

  it('serializes first-message title and transcript persistence', async () => {
    const storage = new DelayedStorage();
    const session = storedSession('session-a', '', 1);
    session.title = 'Chat 1';
    session.messages = [];
    await storage.set('agent:session_list', [{
      id: session.id,
      title: session.title,
      model: session.model,
      messageCount: 0,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }]);
    await storage.set('agent:session:session-a', session);
    const platform = makeBrowserPlatform(storage);
    const { config } = buildPiAgentConfig();
    let state: ProbeState | null = null;
    const view = render(
      <AgentProvider platform={platform} config={config}>
        <SessionProbe onState={(next) => { state = next; }} />
      </AgentProvider>,
    );

    await waitFor(() => {
      expect(state?.chat.activeSessionId).toBe('session-a');
      expect(state?.chat.runtimeSessionId).toBe('session-a');
    });
    const scripter = new EventScripter(state!.chat);
    scripter.addResponse([
      nativeTextDelta('SAVED_REPLY'),
      ...nativeAssistantLifecycle({ content: 'SAVED_REPLY' }),
    ]);
    await act(async () => {
      await state!.chat.sendMessage('SAVE_ME');
    });
    await waitFor(async () => {
      const saved = await storage.get<typeof session>('agent:session:session-a');
      expect(saved?.messages.map((message) => message.content)).toEqual([
        'SAVE_ME',
        'SAVED_REPLY',
      ]);
    });
    scripter.restore();
    view.unmount();
  });

  it('restores a checkpoint when the stored session transcript is still empty', async () => {
    const storage = new DelayedStorage();
    const session = storedSession('session-a', '', 1);
    session.messages = [];
    await storage.set('agent:session_list', [{
      id: session.id,
      title: session.title,
      model: session.model,
      messageCount: 0,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }]);
    await storage.set('agent:session:session-a', session);
    await storage.set('agent:checkpoint:session-a', JSON.stringify({
      messages: [
        { role: 'user', content: 'CHECKPOINT_USER', timestamp: 1 },
        fauxAssistantMessage([fauxText('CHECKPOINT_ASSISTANT')]),
      ],
      model: 'test-model',
      updatedAt: 2,
    }));
    const platform = makeBrowserPlatform(storage);
    const { config } = buildPiAgentConfig({
      capabilities: { resumeManager: new SessionResumeManager(storage) },
    });
    let state: ProbeState | null = null;
    const view = render(
      <AgentProvider platform={platform} config={config}>
        <SessionProbe onState={(next) => { state = next; }} />
      </AgentProvider>,
    );

    await waitFor(() => expect(state?.chat.messages.map((message) => message.content)).toEqual([
      'CHECKPOINT_USER',
      'CHECKPOINT_ASSISTANT',
    ]));
    expect(state!.chat.runtimeSessionId).toBe('session-a');
    view.unmount();
  });

  it('keeps the latest session owner after rapid switches without displaying noncanonical history', async () => {
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
    await waitFor(() => expect(state?.chat.runtimeSessionId).toBe('session-a'));
    expect(state!.chat.messages).toEqual([]);

    await act(async () => {
      await Promise.all([
        state!.session.switchTo('session-b'),
        state!.session.switchTo('session-c'),
      ]);
    });

    await waitFor(() => expect(state?.session.currentSessionId).toBe('session-c'));
    expect(state!.chat.activeSessionId).toBe('session-c');
    expect(state!.chat.messages).toEqual([]);
    view.unmount();
  });

  it('opens the requested popout session without displaying noncanonical history', async () => {
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
    await waitFor(() => expect(state?.chat.runtimeSessionId).toBe('session-b'));
    expect(state!.chat.messages).toEqual([]);
    view.unmount();
  });
});
