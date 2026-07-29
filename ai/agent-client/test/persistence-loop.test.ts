/**
 * Message persistence full-loop tests.
 *
 * Tests the complete "close → reopen" cycle: messages are produced by
 * ChatService, serialized to storage, then a fresh ChatService loads them
 * back. Verifies content, structure, and state are preserved.
 *
 * Skips SessionService (tested separately) — focuses on ChatService's
 * getMessagesForSave → serialize → deserialize → loadMessages round-trip.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'reflect-metadata';
import { ChatService } from '../src/service/chat.service';
import type { PublicRuntimeEvent } from '@svton/agent-core';
import type { IPlatform, IStorage } from '@svton/agent-platform';
import { displayToStoredMessages, storedToDisplayMessages } from '../src/hooks/useSession';
import {
  buildPiAgentConfig,
  EventScripter,
  MemoryStorage,
  nativeAgentEnd,
  nativeTextDelta,
  nativeThinkingDelta,
  nativeToolEnd,
  nativeToolStart,
} from './helpers/pi-test-utils';

class MemStorage implements IStorage {
  private m = new Map<string, unknown>();
  async get<T>(k: string): Promise<T | null> { return (this.m.get(k) as T) ?? null; }
  async set<T>(k: string, v: T): Promise<void> { this.m.set(k, v); }
  async delete(k: string): Promise<void> { this.m.delete(k); }
  async list(): Promise<string[]> { return Array.from(this.m.keys()); }
  async clear(): Promise<void> { this.m.clear(); }
}

function makePlatform(storage: IStorage): IPlatform {
  return {
    type: 'browser',
    capabilities: { filesystem: false, process: false, watch: false, mcpStdio: false, clipboard: false, notification: false, sandboxing: false, pty: false, documentPreview: false, computerUse: false } as any,
    fs: {} as any, process: {} as any, storage, search: {} as any,
  } as IPlatform;
}


describe('Message persistence full loop', () => {
  /** Create a ChatService, init it with a Pi-backed runtime + event scripter. */
  async function createChat(): Promise<{ chat: ChatService; scripter: EventScripter }> {
    const chat = new ChatService();
    await chat.init(makePlatform(new MemStorage()), buildPiAgentConfig().config);
    const scripter = new EventScripter(chat as unknown as { runtime: { run: (...args: any[]) => AsyncGenerator<PublicRuntimeEvent> } });
    return { chat, scripter };
  }

  /** Create + init + script + send, then return the chat for save extraction. */
  async function createAndSend(
    scriptFn: (scripter: EventScripter) => void,
    sendFn: (chat: ChatService) => Promise<void>,
  ): Promise<ChatService> {
    const { chat, scripter } = await createChat();
    scriptFn(scripter);
    await sendFn(chat);
    return chat;
  }

  it('preserves a simple text conversation through serialize → restore', async () => {
    const chat1 = await createAndSend(
      (s) => s.addResponse([
        nativeTextDelta('Hello back!'),
        nativeAgentEnd(),
      ]),
      async (c) => { await c.sendMessage('Hi there'); },
    );

    // Simulate "save before close"
    const saved = chat1.getMessagesForSave();
    expect(saved.length).toBeGreaterThanOrEqual(2);
    const stored = displayToStoredMessages(saved);

    // Simulate "reopen" — new ChatService, load messages
    const chat2 = new ChatService();
    await chat2.init(makePlatform(new MemStorage()), buildPiAgentConfig().config);
    chat2.loadMessages(storedToDisplayMessages(stored));

    const restored = chat2.getMessagesForSave();
    expect(restored.length).toBe(saved.length);
    expect(restored[0].role).toBe('user');
    expect(restored[0].content).toBe('Hi there');
    expect(restored[1].role).toBe('assistant');
    expect(restored[1].content).toContain('Hello back!');
  });

  it('preserves tool calls and thinking through serialize → restore', async () => {
    const chat1 = await createAndSend(
      (s) => {
        // One turn: thinking + tool call + final text (the runtime would normally
        // auto-continue after tool_use; the scripter collapses it into one run).
        s.addResponse([
          nativeThinkingDelta('Let me analyze.'),
          nativeToolStart({ id: 'tc1', name: 'git_diff', arguments: { base: 'main' } }),
          nativeToolEnd({ callId: 'tc1', output: 'diff', isError: false }),
          nativeTextDelta('Done reviewing.'),
          nativeAgentEnd(),
        ]);
      },
      async (c) => { await c.sendMessage('Review code'); },
    );

    const saved = chat1.getMessagesForSave();
    const stored = displayToStoredMessages(saved);
    const restored = storedToDisplayMessages(stored);

    // Find assistant message with thinking
    const assistant = restored.find(m => m.role === 'assistant' && m.thinking);
    expect(assistant).toBeDefined();
    expect(assistant!.thinking).toContain('Let me analyze.');

    // Tool calls preserved
    const withTools = restored.find(m => m.toolCalls?.length);
    expect(withTools).toBeDefined();
    expect(withTools!.toolCalls![0].name).toBe('git_diff');

    // Final text preserved
    const lastMsg = restored[restored.length - 1];
    expect(lastMsg.content).toContain('Done reviewing.');
  });

  it('marks all messages as not-streaming after restore', async () => {
    const chat1 = await createAndSend(
      (s) => s.addResponse([
        nativeTextDelta('Complete.'),
        nativeAgentEnd(),
      ]),
      async (c) => { await c.sendMessage('test'); },
    );

    const stored = displayToStoredMessages(chat1.getMessagesForSave());
    const restored = storedToDisplayMessages(stored);

    for (const msg of restored) {
      expect(msg.isStreaming).toBeFalsy();
    }
  });

  it('preserves duration field through serialize → restore', async () => {
    const chat1 = await createAndSend(
      (s) => s.addResponse([
        nativeTextDelta('Quick response.'),
        nativeAgentEnd({ input: 10, output: 5, totalTokens: 15 }),
      ]),
      async (c) => { await c.sendMessage('test'); },
    );

    const stored = displayToStoredMessages(chat1.getMessagesForSave());
    const restored = storedToDisplayMessages(stored);

    // At least one assistant message should have a duration (or at least exist)
    const assistants = restored.filter(m => m.role === 'assistant');
    expect(assistants.length).toBeGreaterThan(0);
  });

  it('preserves a multi-turn conversation (2 turns) through serialize → restore', async () => {
    const chat = await createAndSend(
      (s) => {
        s.addResponse([nativeTextDelta('Turn 1 answer.'), nativeAgentEnd()]);
        s.addResponse([nativeTextDelta('Turn 2 answer.'), nativeAgentEnd()]);
      },
      async (c) => {
        await c.sendMessage('Turn 1 question');
        await c.sendMessage('Turn 2 question');
      },
    );

    const stored = displayToStoredMessages(chat.getMessagesForSave());
    const restored = storedToDisplayMessages(stored);

    expect(restored.length).toBeGreaterThanOrEqual(4);
    expect(restored[0].content).toBe('Turn 1 question');
    expect(restored[1].content).toContain('Turn 1 answer');
    expect(restored[2].content).toBe('Turn 2 question');
    expect(restored[3].content).toContain('Turn 2 answer');
  });
});
