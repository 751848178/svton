import { describe, expect, it, vi } from 'vitest';
import { ChatRunRegistryService } from '../src/service/chat-run-registry.service';
import { reduceSessionRunState } from '../src/service/chat-run-state-machine';
import {
  selectCompatibilityStatus,
  selectComposerState,
  selectPendingDecision,
} from '../src/service/chat-run-selectors';
import type { ChatRunAddress, ChatRunTransition, SessionRunState } from '../src/service/chat-run.types';
import type { MessageStoreHost } from '../src/service/chat-message-store';
import { applyPlanProgressToStore } from '../src/service/chat-message-owner-projection';

const A: ChatRunAddress = { sessionId: 'a', runId: 'run-a' };

function apply(
  state: SessionRunState | null,
  transition: Omit<ChatRunTransition, keyof ChatRunAddress | 'type'> & { type: ChatRunTransition['type'] },
): SessionRunState | null {
  return reduceSessionRunState(state, { ...transition, ...A } as ChatRunTransition);
}

describe('session run state machine', () => {
  it('covers active, both wait phases, finalizing and completion', () => {
    let state = reduceSessionRunState(null, { type: 'start', ...A, at: 10 });
    expect(state?.phase).toBe('inProgress');
    state = apply(state, { type: 'userInputRequested', requestId: 'question-1' });
    expect(state?.phase).toBe('waitingOnUserInput');
    state = apply(state, { type: 'approvalRequested', requestId: 'approval-1' });
    expect(state?.phase).toBe('waitingOnApproval');
    state = apply(state, { type: 'approvalSettled', requestId: 'approval-1' });
    expect(state?.phase).toBe('waitingOnUserInput');
    state = apply(state, { type: 'userInputSettled', requestId: 'question-1' });
    expect(state?.phase).toBe('inProgress');
    state = apply(state, { type: 'finalizing' });
    expect(state?.phase).toBe('finalizing');
    state = apply(state, { type: 'completed', at: 20 });
    expect(state).toMatchObject({ phase: 'completed', completedAt: 20 });
  });

  it.each([
    ['completed', { type: 'completed', at: 20 }],
    ['failed', { type: 'failed', at: 20, error: { message: 'provider failed' } }],
    ['interrupted', { type: 'interrupted', at: 20 }],
  ] as const)('terminalizes as %s and rejects later same-run terminals', (phase, terminal) => {
    const started = reduceSessionRunState(null, { type: 'start', ...A, at: 10 });
    const state = apply(started, terminal);
    const duplicate = apply(state, { type: 'completed', at: 30 });
    expect(state?.phase).toBe(phase);
    expect(duplicate).toBe(state);
  });

  it('derives phase from all remaining pending decisions', () => {
    let state = reduceSessionRunState(null, { type: 'start', ...A, at: 10 });
    state = apply(state, { type: 'approvalRequested', requestId: 'a1' });
    state = apply(state, { type: 'approvalRequested', requestId: 'a2' });
    state = apply(state, { type: 'userInputRequested', requestId: 'u1' });
    state = apply(state, { type: 'approvalSettled', requestId: 'a1' });
    expect(state?.phase).toBe('waitingOnApproval');
    state = apply(state, { type: 'approvalSettled', requestId: 'a2' });
    expect(state?.phase).toBe('waitingOnUserInput');
  });

  it('rejects stale events after a newer run starts in the same session', () => {
    const oldRun = reduceSessionRunState(null, { type: 'start', ...A, at: 10 });
    const newer = reduceSessionRunState(oldRun, {
      type: 'start', sessionId: 'a', runId: 'run-new', at: 20,
    });
    const stale = reduceSessionRunState(newer, {
      type: 'failed', ...A, at: 30, error: { message: 'late' },
    });
    expect(stale).toBe(newer);
    expect(stale?.runId).toBe('run-new');
  });

  it('uses null as a non-colliding unbound-session key', () => {
    const registry = new ChatRunRegistryService();
    registry.start({ sessionId: null, runId: 'ephemeral' }, 1);
    registry.start({ sessionId: 'default', runId: 'bound' }, 2);
    expect(registry.get(null)?.runId).toBe('ephemeral');
    expect(registry.get('default')?.runId).toBe('bound');
  });
});

describe('session run registry and selectors', () => {
  it('notifies only accepted state changes', () => {
    const notify = vi.fn();
    const registry = new ChatRunRegistryService(notify);
    registry.start(A, 10);
    registry.start(A, 10);
    registry.transition({ type: 'approvalSettled', ...A, requestId: 'missing' });
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('keeps selected idle B independent from active/waiting A', () => {
    const registry = new ChatRunRegistryService();
    registry.start(A, 10);
    registry.transition({ type: 'approvalRequested', ...A, requestId: 'approval-1' });
    expect(selectCompatibilityStatus(registry.get('b'))).toBe('idle');
    expect(selectComposerState(registry.get('b'))).toEqual({ mode: 'send', isStreaming: false });
    expect(selectPendingDecision(registry.get('b'))).toBeNull();
    expect(selectPendingDecision(registry.get('a'))).toEqual({
      kind: 'approval', requestId: 'approval-1', count: 1,
    });
  });

  it('maps failed to an error composer without leaving it streaming', () => {
    const registry = new ChatRunRegistryService();
    registry.start(A, 10);
    registry.transition({ type: 'failed', ...A, at: 20, error: { message: 'boom' } });
    expect(selectCompatibilityStatus(registry.get('a'))).toBe('error');
    expect(selectComposerState(registry.get('a'))).toEqual({ mode: 'error', isStreaming: false });
  });

  it('keeps a background owner plan without replacing selected B activePlan', () => {
    const host: MessageStoreHost = {
      messages: [],
      sessionMessages: new Map([['a', [{
        id: 'assistant-a', role: 'assistant', content: '', timestamp: 1, isStreaming: true,
      }]]]),
      status: 'idle', lastUsage: null,
      activePlan: { planId: 'plan-b', steps: [] },
      activeSessionId: 'b', backgroundSessionId: 'a',
    };
    applyPlanProgressToStore(host, {
      callId: 'plan-call', output: 'updated',
      metadata: { planProgress: { planId: 'plan-a', title: 'A', steps: [] } },
    }, 'assistant-a');

    expect(host.activePlan?.planId).toBe('plan-b');
    expect(host.sessionMessages.get('a')?.[0].blocks).toMatchObject([{
      type: 'plan', plan: { planId: 'plan-a', title: 'A' },
    }]);
  });
});
