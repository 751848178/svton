import { expect, vi } from 'vitest';
import type { PublicRuntimeEvent, SvtonAgentRuntime } from '@svton/agent-core';
import { ChatService, type DisplayMessage } from '../../src/service/chat.service';

export function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

export function runtimeFor(service: ChatService, sessionId: string): SvtonAgentRuntime {
  const registry = Reflect.get(service, 'runtimeRegistry') as {
    get: (owner: string) => SvtonAgentRuntime | null;
  };
  const runtime = registry.get(sessionId);
  if (!runtime) throw new Error(`missing runtime ${sessionId}`);
  return runtime;
}

export async function select(service: ChatService, sessionId: string): Promise<void> {
  const current = service.activeSessionId;
  if (current) service.cacheSessionMessages(current, [...service.messages]);
  service.bindSession(sessionId);
  const cached = service.getCachedMessages(sessionId);
  if (cached) {
    await service.loadMessages(cached, {
      preserveLiveApprovals: true,
      preservePendingToolCalls: true,
    });
  } else {
    await service.clearMessages({ preserveLiveApprovals: true });
  }
}

export function runScript(
  runtime: SvtonAgentRuntime,
  script: () => AsyncGenerator<PublicRuntimeEvent>,
) {
  return vi.spyOn(runtime, 'run').mockImplementation(script as never);
}

export function expectSingleTurn(
  messages: DisplayMessage[],
  userContent: string,
  assistantContent?: string,
): DisplayMessage {
  const users = messages.filter((message) => message.role === 'user');
  const assistants = messages.filter((message) => message.role === 'assistant');
  expect(users).toHaveLength(1);
  expect(assistants).toHaveLength(1);
  expect(users[0]?.content).toBe(userContent);
  if (assistantContent !== undefined) expect(assistants[0]?.content).toBe(assistantContent);
  return assistants[0]!;
}

export function fakeRuntime(): SvtonAgentRuntime & {
  abort: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
} {
  return {
    abort: vi.fn(), reset: vi.fn(), getMessages: vi.fn(() => []),
  } as unknown as SvtonAgentRuntime & {
    abort: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  };
}
