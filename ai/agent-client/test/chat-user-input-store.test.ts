import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ChatService } from '../src/service/chat.service';
import { ChatUserInputStore } from '../src/service/chat-user-input-store';
import { toSecretSafeDisplayResult } from '../src/service/chat-user-input-result.utils';

const request = (sessionId: string, requestId: string) => ({
  sessionId,
  requestId,
  questions: [{
    id: 'q', header: 'Question', question: 'Answer?', isOther: false,
    isSecret: true, options: null,
  }, {
    id: 'theme', header: 'Theme', question: 'Choose?', isOther: false,
    isSecret: false, options: null,
  }],
});

describe('ChatUserInputStore', () => {
  it('keeps session-isolated FIFO heads across switches', () => {
    const store = new ChatUserInputStore(() => {});
    store.enqueue(request('a', 'a1'));
    store.enqueue(request('a', 'a2'));
    store.enqueue(request('b', 'b1'));
    expect(store.head('a')?.requestId).toBe('a1');
    expect(store.head('b')?.requestId).toBe('b1');
    store.settle('a', 'a1', 'resolved');
    expect(store.head('a')?.requestId).toBe('a2');
    expect(store.head('b')?.requestId).toBe('b1');
  });

  it('submits atomically once and never retains secret answers', () => {
    const respond = vi.fn(() => true);
    const store = new ChatUserInputStore(() => {}, respond);
    store.enqueue(request('a', 'a1'));
    expect(store.updateDraft('a', 'a1', 'q', 'top-secret')).toBe(true);
    expect(store.updateDraft('a', 'a1', 'theme', 'Blue')).toBe(true);
    expect(store.head('a')?.draft).toEqual({ theme: 'Blue' });
    expect(store.submit('a', 'a1', { q: { answers: ['top-secret'] } })).toBe(true);
    expect(store.submit('a', 'a1', { q: { answers: ['again'] } })).toBe(false);
    expect(respond).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(store.head('a'))).not.toContain('top-secret');
  });

  it('marks failed submission retryable and reload teardown non-actionable', () => {
    const store = new ChatUserInputStore(() => {}, () => false);
    store.enqueue(request('a', 'a1'));
    expect(store.submit('a', 'a1', { q: { answers: ['x'] } })).toBe(false);
    expect(store.head('a')?.state).toBe('error');
    store.interruptAll();
    expect(store.head('a')).toBeNull();
    expect(store.enqueue(request('a', 'a1'))).toBe(false);
  });

  it('redacts native tool results before display persistence', () => {
    const safe = toSecretSafeDisplayResult('request_user_input', {
      callId: 'a1', output: 'top-secret', metadata: { containsSecret: true },
    });
    expect(JSON.stringify(safe)).not.toContain('top-secret');
    expect(safe.output).toContain('submitted');
  });

  it('bounds settled duplicate keys', () => {
    const store = new ChatUserInputStore(() => {});
    for (let index = 0; index < 520; index += 1) {
      const requestId = `request-${index}`;
      store.enqueue(request('a', requestId));
      store.settle('a', requestId, 'resolved');
    }
    expect(store.settledSize).toBe(512);
  });

  it('aborts only the addressed run owner decision queues', () => {
    const service = new ChatService();
    service.bindSession('b');
    const address = { sessionId: 'a', runId: 'run-a' };
    (service as any).runs.start(address, 1);
    service.pendingToolCalls.set('approval-a', {
      sessionId: 'a', call: { id: 'approval-a', name: 'shell', arguments: {} }, resolve: vi.fn(),
    });
    service.pendingToolCalls.set('approval-b', {
      sessionId: 'b', call: { id: 'approval-b', name: 'shell', arguments: {} }, resolve: vi.fn(),
    });
    (service as any).userInputs.enqueue(request('a', 'question-a'));
    (service as any).userInputs.enqueue(request('b', 'question-b'));

    service.abortSession('a');

    expect(service.hasPendingApprovalsForSession('a')).toBe(false);
    expect(service.getPendingApproval()?.requestId).toBe('legacy:approval-b');
    expect((service as any).userInputs.head('a')).toBeNull();
    expect(service.getPendingUserInput()?.requestId).toBe('question-b');
    expect(service.getSessionRunState('a')?.phase).toBe('interrupted');
    expect(service.status).toBe('idle');
  });

  it('rejects an old run event before it can enter the exact request store', () => {
    const service = new ChatService();
    service.bindSession('a');
    const oldAddress = { sessionId: 'a', runId: 'run-old' };
    (service as any).runs.start(oldAddress, 1);
    (service as any).runs.start({ sessionId: 'a', runId: 'run-new' }, 2);

    (service as any).handler.handle(
      { type: 'user_input_requested', request: request('a', 'stale-question') },
      'assistant-old',
      service,
      oldAddress,
    );

    expect(service.getPendingUserInput()).toBeNull();
    expect(service.getSessionRunState('a')).toMatchObject({
      runId: 'run-new', phase: 'inProgress', pendingUserInputIds: [],
    });
  });

  it('keeps background A user input waiting state out of selected B', () => {
    const service = new ChatService();
    const address = { sessionId: 'a', runId: 'run-a' };
    service.bindSession('a');
    (service as any).runs.start(address, 1);
    service.bindSession('b');

    (service as any).handler.handle(
      { type: 'user_input_requested', request: request('a', 'question-a') },
      'assistant-a', service, address,
    );

    expect(service.status).toBe('idle');
    expect(service.isStreaming).toBe(false);
    expect(service.getPendingUserInput()).toBeNull();
    expect(service.getSessionRunState('a')).toMatchObject({
      phase: 'waitingOnUserInput', pendingUserInputIds: ['question-a'],
    });
    service.bindSession('a');
    expect(service.status).toBe('running');
    expect(service.isStreaming).toBe(true);
    expect(service.getPendingUserInput()?.requestId).toBe('question-a');
    expect((service as any).runs.pendingDecision('a')).toMatchObject({
      kind: 'userInput', requestId: 'question-a', count: 1,
    });
    service.bindSession('b');
    expect(service.status).toBe('idle');
  });
});

describe('ChatService user input session selector', () => {
  it('restores each session pending head after switching away and back', () => {
    const service = new ChatService();
    service.bindSession('a');
    service.handleEvent({
      type: 'user_input_requested',
      request: request('a', 'a1'),
    }, 'message-a');
    service.handleEvent({
      type: 'user_input_requested',
      request: request('b', 'b1'),
    }, 'message-b');
    expect(service.updateUserInputDraft('a1', 'theme', 'Blue')).toBe(true);

    expect(service.getPendingUserInput()?.requestId).toBe('a1');
    service.bindSession('b');
    expect(service.getPendingUserInput()?.requestId).toBe('b1');
    service.bindSession('a');
    expect(service.getPendingUserInput()?.requestId).toBe('a1');
    expect(service.getPendingUserInput()?.draft).toEqual({ theme: 'Blue' });

    service.handleEvent({
      type: 'user_input_settled',
      sessionId: 'a',
      requestId: 'a1',
      settlement: 'resolved',
    }, 'message-a');
    expect(service.getPendingUserInput()).toBeNull();
  });
});
