import { describe, expect, it, vi } from 'vitest';
import type { PublicRuntimeEvent, SvtonAgentRuntime } from '@svton/agent-core';
import { ChatService } from '../src/service/chat.service';
import {
  buildPiAgentConfig,
  makeBrowserPlatform,
  nativeAgentEnd,
  nativeTextDelta,
  nativeToolStart,
} from './helpers/pi-test-utils';
import {
  deferred,
  expectSingleTurn,
  fakeRuntime,
  runtimeFor,
  runScript,
  select,
} from './helpers/chat-concurrent-test-utils';

describe('session deletion isolation', () => {
  it('deletes non-selected running A without disturbing or resurrecting B', async () => {
    const service = new ChatService();
    await service.init(makeBrowserPlatform(), buildPiAgentConfig().config, 'stable');
    await select(service, 'a');
    const runtimeA = runtimeFor(service, 'a');
    const finishA = deferred();
    runScript(runtimeA, async function* () {
      yield nativeToolStart({
        id: 'delete-approval-item', name: 'shell', arguments: {},
      }) as PublicRuntimeEvent;
      yield {
        type: 'tool_approval_needed',
        request: {
          requestId: 'delete-approval', sessionId: 'a', itemId: 'delete-approval-item',
          createdAt: 1, toolName: 'shell', arguments: {}, decisions: ['accept', 'decline'],
        },
      } as PublicRuntimeEvent;
      yield {
        type: 'user_input_requested',
        request: {
          requestId: 'delete-question', sessionId: 'a', createdAt: 2,
          questions: [{ id: 'answer', prompt: 'Answer?', type: 'text' }],
        },
      } as PublicRuntimeEvent;
      await finishA.promise;
      yield nativeAgentEnd() as PublicRuntimeEvent;
    });
    const sendA = service.sendMessage('delete A');
    const approvals = Reflect.get(service, 'approvalController') as {
      queue: { head: (owner: string) => unknown };
    };
    const userInputs = Reflect.get(service, 'userInputs') as { head: (owner: string) => unknown };
    await vi.waitFor(() => {
      expect(approvals.queue.head('a')).not.toBeNull();
      expect(userInputs.head('a')).not.toBeNull();
    });

    await select(service, 'b');
    const runtimeB = runtimeFor(service, 'b');
    const finishB = deferred();
    runScript(runtimeB, async function* () {
      yield nativeTextDelta('B running') as PublicRuntimeEvent;
      await finishB.promise;
      yield nativeAgentEnd() as PublicRuntimeEvent;
    });
    const sendB = service.sendMessage('keep B');
    await vi.waitFor(() => expectSingleTurn(service.messages, 'keep B', 'B running'));
    const visibleB = service.messages.map((message) => ({ ...message }));
    const registry = Reflect.get(service, 'runtimeRegistry') as { has: (owner: string) => boolean };
    const ownership = Reflect.get(service, 'runOwnership') as {
      isProcessing: (owner: string) => boolean;
    };

    service.deleteSessionState('a');
    expectDeleted(service, 'a', registry, ownership, approvals, userInputs);
    expect(service.getSessionRunState('b')?.phase).toBe('inProgress');
    expect(service.messages).toEqual(visibleB);

    finishA.resolve();
    await sendA;
    expectDeleted(service, 'a', registry, ownership, approvals, userInputs);
    finishB.resolve();
    await sendB;
  });

  it('cancels deleted background slow creation without installing a stale slot', async () => {
    const service = new ChatService();
    await service.init(makeBrowserPlatform(), buildPiAgentConfig().config, 'stable');
    await select(service, 'b');
    const registry = Reflect.get(service, 'runtimeRegistry') as {
      has: (owner: string) => boolean;
    };
    const stale = deferred<SvtonAgentRuntime>();
    Reflect.set(registry, 'createRuntime', vi.fn(() => stale.promise));
    service.cacheSessionMessages('b', [...service.messages]);
    service.bindSession('slow');
    service.messages = [];
    const sendSlow = service.sendMessage('slow delete');
    expect(service.getSessionRunState('slow')?.phase).toBe('inProgress');
    await select(service, 'b');
    const visibleB = service.messages.map((message) => ({ ...message }));
    const ownership = Reflect.get(service, 'runOwnership') as {
      isProcessing: (owner: string) => boolean;
    };
    const approvals = Reflect.get(service, 'approvalController') as {
      queue: { head: (owner: string) => unknown };
    };
    const userInputs = Reflect.get(service, 'userInputs') as { head: (owner: string) => unknown };

    service.deleteSessionState('slow');
    expectDeleted(service, 'slow', registry, ownership, approvals, userInputs);
    expect(service.messages).toEqual(visibleB);

    const staleRuntime = fakeRuntime();
    stale.resolve(staleRuntime);
    await sendSlow;
    expect(staleRuntime.abort).toHaveBeenCalledOnce();
    expect(staleRuntime.reset).toHaveBeenCalledOnce();
    expectDeleted(service, 'slow', registry, ownership, approvals, userInputs);
    expect(service.messages).toEqual(visibleB);
  });
});

function expectDeleted(
  service: ChatService,
  owner: string,
  registry: { has: (sessionId: string) => boolean },
  ownership: { isProcessing: (sessionId: string) => boolean },
  approvals: { queue: { head: (sessionId: string) => unknown } },
  userInputs: { head: (sessionId: string) => unknown },
): void {
  expect(registry.has(owner)).toBe(false);
  expect(ownership.isProcessing(owner)).toBe(false);
  expect(service.getSessionRunState(owner)).toBeNull();
  expect(service.getCachedMessages(owner)).toBeUndefined();
  expect(approvals.queue.head(owner)).toBeNull();
  expect(userInputs.head(owner)).toBeNull();
}
