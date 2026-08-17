import { describe, expect, it, vi } from 'vitest';
import type { AgentMessage, SerializedRuntime } from '@svton/agent-core';
import { fauxAssistantMessage, fauxText } from './helpers/pi-test-utils';
import { ChatSessionRuntimeService } from '../src/service/chat-session-runtime.service';
import { displayToStoredMessages, storedToDisplayMessages } from '../src/hooks/session-message-conversion.utils';
import type { DisplayMessage } from '../src/types';
import type { ChatRunRecovery } from '../src/service/chat-run-journal.types';

describe('checkpoint and interrupted display reconciliation', () => {
  it('keeps checkpoint N canonical and appends exact journal N+1 display evidence', async () => {
    const runtime = checkpointRuntime(canonicalTurn('first', 'first complete'), 1);
    const persisted = interruptedEvidence('second', 'second partial', 2);
    const restored = await new ChatSessionRuntimeService().restore(
      runtime.value,
      'session-a',
      persisted,
      () => true,
      recovery(2),
    );
    expect(runtime.messages()).toHaveLength(2);
    expect(restored?.map((message) => message.content)).toEqual([
      'first', 'first complete', 'second', 'second partial', 'Turn interrupted',
    ]);
    expect(restored?.find((message) => message.id === 'assistant-run-2')?.timeline?.status)
      .toBe('interrupted');
  });

  it('keeps checkpoint N+1 canonical without duplicating its interrupted visible turn', async () => {
    const canonical = [
      ...canonicalTurn('first', 'first complete', 1),
      ...canonicalTurn('second', 'second canonical', 3),
    ];
    const runtime = checkpointRuntime(canonical, 2);
    const restored = await new ChatSessionRuntimeService().restore(
      runtime.value,
      'session-a',
      interruptedEvidence('second', 'second partial', 2),
      () => true,
      recovery(2),
    );
    expect(restored?.filter((message) => message.role === 'user' && message.content === 'second'))
      .toHaveLength(1);
    expect(restored?.find((message) => message.id === 'assistant-run-2')).toMatchObject({
      content: 'second canonical',
      runId: 'run-2',
      timeline: { status: 'interrupted' },
    });
    expect(runtime.messages()).toHaveLength(4);
  });

  it('restores a completed checkpoint exactly idle without an interrupted marker', async () => {
    const runtime = checkpointRuntime(canonicalTurn('done', 'complete'), 1);
    const restored = await new ChatSessionRuntimeService().restore(
      runtime.value,
      'session-a',
      [],
      () => true,
      { state: completedState(), recoveredAsInterrupted: false },
    );
    expect(restored?.map((message) => message.content)).toEqual(['done', 'complete']);
    expect(restored?.some((message) => message.content === 'Turn interrupted')).toBe(false);
  });

  it('round-trips exact run and canonical index ownership through display storage', () => {
    const evidence = interruptedEvidence('second', 'partial', 2);
    const restored = storedToDisplayMessages(displayToStoredMessages(evidence));
    expect(restored.map(({ runId, runtimeMessageIndex }) => ({ runId, runtimeMessageIndex })))
      .toEqual([
        { runId: 'run-2', runtimeMessageIndex: 2 },
        { runId: 'run-2', runtimeMessageIndex: undefined },
      ]);
  });
});

function recovery(turnRevision: number): ChatRunRecovery {
  return {
    recoveredAsInterrupted: true,
    state: {
      sessionId: 'session-a', runId: `run-${turnRevision}`, turnRevision,
      phase: 'interrupted', startedAt: 10, completedAt: 30,
      pendingApprovalIds: [], pendingUserInputIds: [], revision: 3,
    },
  };
}

function completedState(): NonNullable<ChatRunRecovery['state']> {
  return { ...recovery(1).state!, phase: 'completed' };
}

function interruptedEvidence(
  user: string,
  assistant: string,
  runtimeMessageIndex: number,
): DisplayMessage[] {
  return [
    {
      id: 'user-run-2', role: 'user', content: user, timestamp: 10,
      runId: 'run-2', runtimeMessageIndex,
    },
    {
      id: 'assistant-run-2', role: 'assistant', content: assistant, timestamp: 11,
      runId: 'run-2', isStreaming: false,
      timeline: {
        version: 1, sessionId: 'session-a', turnId: 'run-2', status: 'running',
        revision: 1, startedAt: 10, items: [],
      },
    },
  ];
}

function canonicalTurn(user: string, assistant: string, timestamp = 1): AgentMessage[] {
  return [
    { role: 'user', content: user, timestamp },
    fauxAssistantMessage([fauxText(assistant)], { timestamp: timestamp + 1 }),
  ];
}

function checkpointRuntime(initial: AgentMessage[], runRevision: number) {
  let messages = initial;
  const checkpoint: SerializedRuntime = {
    messages: initial, model: 'test-model', updatedAt: 20, runRevision,
  };
  const value = {
    getResumeManager: () => ({
      load: vi.fn(async () => checkpoint),
      applyLoadedState: vi.fn((state: SerializedRuntime) => { messages = state.messages; }),
    }),
    reset: vi.fn(),
    getMessages: () => messages,
    getCanonicalMessages: () => messages,
  } as never;
  return { value, messages: () => messages };
}
