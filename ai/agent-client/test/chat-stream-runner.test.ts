import { describe, expect, it, vi } from 'vitest';
import { ChatRunCoordinatorService } from '../src/service/chat-run-coordinator.service';
import { ChatRunOwnershipService } from '../src/service/chat-run-ownership.service';
import { finalizeStreamEnd, runAssistantTurn } from '../src/service/chat-stream-runner';
import type { MessageStoreHost } from '../src/service/chat-message-store';

function store(sessionId: string): MessageStoreHost {
  return {
    messages: [], sessionMessages: new Map(), status: 'idle', lastUsage: null,
    activePlan: null, activeSessionId: sessionId, backgroundSessionId: null,
  };
}

function handler() {
  return { handle: vi.fn(), handleProviderFailure: vi.fn(), resetSequenceState: vi.fn() };
}

describe('chat stream run lifecycle', () => {
  it('publishes inProgress, finalizing and completed for the captured owner', async () => {
    const phases: string[] = [];
    const snapshots: Array<{ phase: string; streaming: boolean | undefined }> = [];
    const owner = store('a');
    let runs!: ChatRunCoordinatorService;
    runs = new ChatRunCoordinatorService(() => {
      const phase = runs.state('a')?.phase;
      if (phase) {
        phases.push(phase);
        snapshots.push({ phase, streaming: owner.messages[0]?.isStreaming });
      }
    }, () => 'run-a');

    await runAssistantTurn({
      runtime: { async *run() {} }, handler: handler() as never, store: owner,
      ownership: new ChatRunOwnershipService(), runs,
      onBackgroundStreamEnd: null,
      createDisplayMessage: (role, content) => ({
        id: 'assistant-a', role, content, timestamp: 1,
      }),
    }, runs.createAddress('a'), 'hello', undefined);

    expect(phases).toEqual(['inProgress', 'finalizing', 'completed']);
    expect(runs.state('a')).toMatchObject({ runId: 'run-a', phase: 'completed' });
    expect(owner.messages[0]).toMatchObject({ id: 'assistant-a', isStreaming: false });
    expect(snapshots.at(-1)).toEqual({ phase: 'completed', streaming: false });
    expect(snapshots).not.toContainEqual({ phase: 'completed', streaming: true });
  });

  it('passes the exact monotonic turn revision into the runtime checkpoint path', async () => {
    const run = vi.fn(async function* () {});
    const runs = new ChatRunCoordinatorService(() => {}, () => 'run-revision');
    await runAssistantTurn({
      runtime: { run }, handler: handler() as never, store: store('a'),
      ownership: new ChatRunOwnershipService(), runs,
      onBackgroundStreamEnd: null,
      createDisplayMessage: (role, content) => ({
        id: 'assistant-revision', role, content, timestamp: 1,
      }),
    }, runs.createAddress('a'), 'hello', undefined);
    expect(run).toHaveBeenCalledWith('hello', {
      sessionId: 'a', runRevision: 1,
    });
  });

  it('awaits exact message_end display persistence before a held terminal settles', async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const owner = store('a');
    const snapshots: Array<import('../src/types').DisplayMessage[]> = [];
    const eventHandler = handler();
    eventHandler.handle.mockImplementation((event, assistantId) => {
      if (event.type !== 'message_update') return;
      owner.messages = owner.messages.map((message) => message.id === assistantId
        ? { ...message, content: message.content + event.assistantMessageEvent.delta }
        : message);
    });
    const runs = new ChatRunCoordinatorService(() => {}, () => 'run-held');
    const turn = runAssistantTurn({
      runtime: {
        async *run() {
          yield {
            type: 'message_update',
            assistantMessageEvent: { type: 'text_delta', delta: 'exact answer' },
          } as never;
          yield {
            type: 'message_end', message: { role: 'assistant', stopReason: 'stop' },
          } as never;
          await held;
          yield { type: 'agent_end', messages: [] } as never;
        },
      },
      handler: eventHandler as never,
      store: owner,
      ownership: new ChatRunOwnershipService(),
      runs,
      onBackgroundStreamEnd: null,
      persistRunDisplay: async () => {
        snapshots.push(owner.messages.map((message) => ({ ...message })));
      },
      createDisplayMessage: (role, content) => ({
        id: 'assistant-held', role, content, timestamp: 1,
      }),
    }, runs.createAddress('a'), 'hello', undefined);
    await vi.waitFor(() => expect(snapshots.some((snapshot) => (
      snapshot[0]?.content === 'exact answer'
      && snapshot[0]?.runId === 'run-held'
    ))).toBe(true));
    expect(runs.state('a')?.phase).toBe('inProgress');
    release();
    await turn;
  });

  it('terminalizes provider message_end errors as failed, never completed', async () => {
    const phases: string[] = [];
    let runs!: ChatRunCoordinatorService;
    runs = new ChatRunCoordinatorService(() => {
      const phase = runs.state('a')?.phase;
      if (phase) phases.push(phase);
    }, () => 'run-error');

    await runAssistantTurn({
      runtime: {
        async *run() {
          yield {
            type: 'message_end',
            message: { role: 'assistant', stopReason: 'error', errorMessage: 'provider failed' },
          } as never;
        },
      },
      handler: handler() as never,
      store: store('a'),
      ownership: new ChatRunOwnershipService(),
      runs,
      onBackgroundStreamEnd: null,
      createDisplayMessage: (role, content) => ({
        id: 'assistant-error', role, content, timestamp: 1,
      }),
    }, runs.createAddress('a'), 'hello', undefined);

    expect(phases).toEqual(['inProgress', 'finalizing', 'failed']);
    expect(runs.state('a')).toMatchObject({
      phase: 'failed', error: { message: 'provider failed' },
    });
  });

  it('finalizes background A only while selected B remains untouched', () => {
    const owner = store('b');
    owner.status = 'idle';
    owner.messages = [{
      id: 'assistant-b', role: 'assistant', content: 'B', timestamp: 1, isStreaming: false,
    }];
    owner.sessionMessages.set('a', [{
      id: 'assistant-a', role: 'assistant', content: 'A', timestamp: 1, isStreaming: true,
    }]);
    const backgroundEnd = vi.fn();

    finalizeStreamEnd(
      owner,
      { sessionId: 'a', runId: 'run-a' },
      'assistant-a',
      { isStreaming: false, duration: 5 },
      backgroundEnd,
      { current: 'assistant-a' },
    );

    expect(owner.messages[0]).toMatchObject({ id: 'assistant-b', content: 'B' });
    expect(owner.sessionMessages.get('a')?.[0]).toMatchObject({
      id: 'assistant-a', isStreaming: false, duration: 5,
    });
    expect(owner.status).toBe('idle');
    expect(backgroundEnd).toHaveBeenCalledWith('a');
  });

  it('rejects old final settlement after the registry has a newer same-session run', async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const runs = new ChatRunCoordinatorService(() => {}, () => 'run-old');
    const owner = store('a');
    const turn = runAssistantTurn({
      runtime: { async *run() { await held; } },
      handler: handler() as never,
      store: owner,
      ownership: new ChatRunOwnershipService(),
      runs,
      onBackgroundStreamEnd: null,
      createDisplayMessage: (role, content) => ({
        id: 'assistant-old', role, content, timestamp: 1,
      }),
    }, runs.createAddress('a'), 'old', undefined);
    await vi.waitFor(() => expect(runs.state('a')?.runId).toBe('run-old'));
    runs.start({ sessionId: 'a', runId: 'run-new' }, 2);
    release();
    await turn;

    expect(runs.state('a')).toMatchObject({ runId: 'run-new', phase: 'inProgress' });
    expect(owner.messages[0]).toMatchObject({ id: 'assistant-old', isStreaming: true });
  });

  it('does not clear the current assistant ownership for another message finalization', () => {
    const owner = store('a');
    owner.messages = [{
      id: 'assistant-old', role: 'assistant', content: '', timestamp: 1, isStreaming: true,
    }];
    const ownership = { current: 'assistant-new' };

    finalizeStreamEnd(
      owner,
      { sessionId: 'a', runId: 'run-old' },
      'assistant-old',
      { isStreaming: false },
      null,
      ownership,
    );

    expect(ownership.current).toBe('assistant-new');
  });
});
