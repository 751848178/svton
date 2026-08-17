import { describe, expect, it, vi } from 'vitest';
import type { PublicRuntimeEvent } from '@svton/agent-core';
import { ChatService } from '../src/service/chat.service';
import {
  buildPiAgentConfig,
  makeBrowserPlatform,
  nativeAgentEnd,
  nativeTextDelta,
  nativeToolEnd,
  nativeToolStart,
} from './helpers/pi-test-utils';
import {
  deferred,
  expectSingleTurn,
  runtimeFor,
  runScript,
  select,
} from './helpers/chat-concurrent-test-utils';

describe('true concurrent chat sessions', () => {
  it('interleaves A/B deltas and restores owner-exact usage and plans on every switch', async () => {
    const service = new ChatService();
    await service.init(makeBrowserPlatform(), buildPiAgentConfig().config, 'stable');
    await select(service, 'a');
    const runtimeA = runtimeFor(service, 'a');
    const aDelta = deferred();
    const aFinish = deferred();
    runScript(runtimeA, async function* () {
      await aDelta.promise;
      yield nativeTextDelta('A-delta') as PublicRuntimeEvent;
      yield nativeToolStart({ id: 'shared-call', name: 'plan_create', arguments: {} }) as PublicRuntimeEvent;
      yield nativeToolEnd({
        callId: 'shared-call', output: 'A plan',
        metadata: { planProgress: { planId: 'plan-a', title: 'Plan A', steps: [] } },
      }, 'plan_create') as PublicRuntimeEvent;
      await aFinish.promise;
      yield nativeAgentEnd({ totalTokens: 11, input: 10, output: 1 }) as PublicRuntimeEvent;
    });
    const sendA = service.sendMessage('A user');
    expect(service.getSessionRunState('a')?.phase).toBe('inProgress');

    await select(service, 'b');
    expect(service.canSend).toBe(true);
    const runtimeB = runtimeFor(service, 'b');
    const bDelta = deferred();
    const bFinish = deferred();
    runScript(runtimeB, async function* () {
      await bDelta.promise;
      yield nativeTextDelta('B-delta') as PublicRuntimeEvent;
      yield nativeToolStart({ id: 'shared-call', name: 'plan_create', arguments: {} }) as PublicRuntimeEvent;
      yield nativeToolEnd({
        callId: 'shared-call', output: 'B plan',
        metadata: { planProgress: { planId: 'plan-b', title: 'Plan B', steps: [] } },
      }, 'plan_create') as PublicRuntimeEvent;
      await bFinish.promise;
      yield nativeAgentEnd({ totalTokens: 22, input: 20, output: 2 }) as PublicRuntimeEvent;
    });
    const sendB = service.sendMessage('B user');
    expect(service.getSessionRunState('b')?.phase).toBe('inProgress');

    aDelta.resolve();
    await vi.waitFor(() => {
      expectSingleTurn(service.getCachedMessages('a') ?? [], 'A user', 'A-delta');
    });
    expect(service.messages.every((message) => !message.content.includes('A-delta'))).toBe(true);
    bDelta.resolve();
    await vi.waitFor(() => expectSingleTurn(service.messages, 'B user', 'B-delta'));
    expect(service.activePlan?.planId).toBe('plan-b');
    await select(service, 'a');
    expectSingleTurn(service.messages, 'A user', 'A-delta');
    expect(service.activePlan?.planId).toBe('plan-a');
    await select(service, 'b');
    expectSingleTurn(service.messages, 'B user', 'B-delta');

    aFinish.resolve();
    await sendA;
    expect(service.getSessionRunState('a')?.phase).toBe('completed');
    expect(service.getSessionRunState('b')?.phase).toBe('inProgress');
    expect(service.status).toBe('running');
    bFinish.resolve();
    await sendB;
    expect(service.lastUsage?.totalTokens).toBe(22);

    service.cacheSessionMessages('b', [...service.messages]);
    service.bindSession('a');
    service.messages = [...(service.getCachedMessages('a') ?? [])];
    const assistantA = expectSingleTurn(service.messages, 'A user', 'A-delta');
    expect(service.lastUsage?.totalTokens).toBe(11);
    expect(service.activePlan?.planId).toBe('plan-a');
    expect(assistantA.toolCalls?.find((call) => call.id === 'shared-call')?.result)
      .toMatchObject({ output: 'A plan' });
    service.cacheSessionMessages('a', [...service.messages]);
    service.bindSession('b');
    service.messages = [...(service.getCachedMessages('b') ?? [])];
    const assistantB = expectSingleTurn(service.messages, 'B user', 'B-delta');
    expect(service.lastUsage?.totalTokens).toBe(22);
    expect(service.activePlan?.planId).toBe('plan-b');
    expect(assistantB.toolCalls?.find((call) => call.id === 'shared-call')?.result)
      .toMatchObject({ output: 'B plan' });
  });

  it('dispatches simultaneous A approval and B user input to exact runtimes once', async () => {
    const service = new ChatService();
    await service.init(makeBrowserPlatform(), buildPiAgentConfig().config, 'stable');
    await select(service, 'a');
    const runtimeA = runtimeFor(service, 'a');
    const finishA = deferred();
    const approveA = vi.spyOn(runtimeA, 'settleToolApproval').mockReturnValue(true);
    runScript(runtimeA, async function* () {
      yield nativeToolStart({ id: 'approval-item', name: 'shell', arguments: {} }) as PublicRuntimeEvent;
      yield {
        type: 'tool_approval_needed',
        request: {
          requestId: 'approval-a', sessionId: 'a', itemId: 'approval-item',
          createdAt: 1, toolName: 'shell', arguments: {}, decisions: ['accept', 'decline', 'cancel'],
        },
      } as PublicRuntimeEvent;
      await finishA.promise;
      yield nativeAgentEnd() as PublicRuntimeEvent;
    });
    const sendA = service.sendMessage('approve A');
    await vi.waitFor(() => expect(service.getSessionRunState('a')?.phase).toBe('waitingOnApproval'));

    await select(service, 'b');
    const runtimeB = runtimeFor(service, 'b');
    const finishB = deferred();
    const answerB = vi.spyOn(runtimeB, 'respondToUserInput').mockReturnValue(true);
    runScript(runtimeB, async function* () {
      yield {
        type: 'user_input_requested',
        request: {
          requestId: 'question-b', sessionId: 'b', createdAt: 2,
          questions: [{ id: 'answer', prompt: 'Answer?', type: 'text' }],
        },
      } as PublicRuntimeEvent;
      await finishB.promise;
      yield nativeAgentEnd() as PublicRuntimeEvent;
    });
    const sendB = service.sendMessage('question B');
    await vi.waitFor(() => expect(service.getPendingUserInput()?.requestId).toBe('question-b'));
    expect(service.submitUserInput('question-b', { answer: 'B' })).toBe(true);
    expect(answerB).toHaveBeenCalledTimes(1);
    expect(approveA).not.toHaveBeenCalled();

    await select(service, 'a');
    expect(service.getPendingApproval()?.requestId).toBe('approval-a');
    expect(service.settleToolApproval('approval-a', 'accept')).toBe(true);
    expect(approveA).toHaveBeenCalledTimes(1);
    expect(answerB).toHaveBeenCalledTimes(1);
    finishB.resolve(); finishA.resolve();
    await Promise.all([sendA, sendB]);
  });
});
