import { describe, expect, it } from 'vitest';
import type { PublicRuntimeEvent } from '@svton/agent-core';
import { reduceTimeline } from '../src/timeline/lifecycle.reducer';
import {
  createProviderFailureAction,
  selectTimelineActions,
} from '../src/timeline/public-event-selector';
import type { TimelineAction, TimelineTurn } from '../src/timeline/types';
import {
  MAX_PROGRESS_ENTRIES,
  MAX_PROGRESS_TEXT,
  MAX_TIMELINE_ITEMS,
} from '../src/timeline/bounds';

const context = {
  sessionId: 's1', turnId: 'm1', retryMessageId: 'user-1', now: () => 100,
};

describe('timeline reducer lifecycle', () => {
  it('retains two real partials through successful completion', () => {
    const state = applyEvents([
      start('bash', { command: 'echo ok' }),
      update('first partial'),
      update('second partial'),
      end(false, { command: 'echo ok', stdout: 'ok', stderr: '', exitCode: 0, durationMs: 12 }),
    ]);
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({
      kind: 'commandExecution', status: 'completed', stdout: 'ok', exitCode: 0, durationMs: 12,
      progress: [{ text: 'first partial' }, { text: 'second partial' }],
    });
  });

  it('shows nonzero exit and stderr as a failed terminal outcome', () => {
    const state = applyEvents([
      start('bash', { command: 'exit 7' }),
      end(true, { command: 'exit 7', stdout: '', stderr: 'boom', exitCode: 7 }),
    ]);
    expect(state.items[0]).toMatchObject({
      status: 'failed', stderr: 'boom', exitCode: 7,
      retry: { kind: 'message', messageId: 'user-1' },
    });
  });

  it('treats signal-only command termination as failed', () => {
    const state = applyEvents([
      start('bash', { command: 'sleep 10' }),
      end(false, { command: 'sleep 10', exitCode: null, signal: 'SIGTERM', timedOut: false }),
    ]);
    expect(state.items[0]).toMatchObject({
      status: 'failed', exitCode: null, signal: 'SIGTERM', timedOut: false,
    });
  });

  it('ignores late updates after terminal completion', () => {
    const state = applyEvents([
      start('tool', {}), update('kept'), end(false), update('late'),
    ]);
    expect('progress' in state.items[0] && state.items[0].progress.map((entry) => entry.text))
      .toEqual(['kept']);
  });

  it('interrupts an active item while preserving partial output', () => {
    let state = applyEvents([start('tool', {}), update('partial before abort')]);
    state = reduceTimeline(state, {
      type: 'interruptTurn', sessionId: 's1', turnId: 'm1', at: 200,
    });
    expect(state.status).toBe('interrupted');
    expect(state.items[0]).toMatchObject({ status: 'interrupted', progress: [{ text: 'partial before abort' }] });
  });

  it('creates one visible provider exception outcome', () => {
    const action = createProviderFailureAction('provider exploded', context);
    const state = reduceTimeline(undefined, action);
    expect(state.status).toBe('failed');
    expect(state.items).toEqual([expect.objectContaining({
      kind: 'error', lane: 'outcome', diagnostic: 'provider exploded', status: 'failed',
      retry: { kind: 'message', messageId: 'user-1' },
    })]);
    expect(reduceTimeline(state, action)).toEqual(state);
  });

  it.each([
    ['decline', 'declined'],
    ['cancel', 'cancelled'],
    ['interrupted', 'interrupted'],
  ])('keeps approval %s out of failed execution semantics', (decision, status) => {
    const state = applyEvents([
      start('tool', {}),
      end(true, { approval: { decision } }),
    ]);
    expect(state.items[0]).toMatchObject({ status });
    expect(state.items[0]).not.toHaveProperty('retry');
  });

  it('redacts arguments and bounds persisted progress count and text', () => {
    const events = [start('tool', {
      password: 'raw-password', nested: { accessToken: 'raw-token' },
    })];
    for (let index = 0; index < MAX_PROGRESS_ENTRIES + 10; index += 1) {
      events.push(update(`step-${index} password=raw-progress-${index} ${'x'.repeat(MAX_PROGRESS_TEXT + 100)}`));
    }
    const state = applyEvents(events);
    const item = state.items[0];
    expect(JSON.stringify(item)).not.toContain('raw-password');
    expect(JSON.stringify(item)).not.toContain('raw-token');
    expect(JSON.stringify(item)).not.toContain('raw-progress');
    expect('progress' in item && item.progress).toHaveLength(MAX_PROGRESS_ENTRIES);
    expect('progress' in item && item.progress.every((entry) => entry.text.length <= MAX_PROGRESS_TEXT))
      .toBe(true);
  });

  it('caps live items and preserves the latest outcomes', () => {
    let state: TimelineTurn | undefined;
    for (let index = 0; index < MAX_TIMELINE_ITEMS + 5; index += 1) {
      state = reduceTimeline(state, {
        type: 'addOutcome', sessionId: 's1', turnId: 'm1', at: index,
        item: {
          id: `warning-${index}`, sessionId: 's1', turnId: 'm1', kind: 'warning',
          lane: 'outcome', status: 'completed', title: 'Warning',
          diagnostic: `latest-${index}`, revision: 0,
        },
      });
    }
    expect(state?.items).toHaveLength(MAX_TIMELINE_ITEMS);
    expect(state?.items[0].id).toBe('warning-5');
    expect(state?.items.at(-1)?.id).toBe(`warning-${MAX_TIMELINE_ITEMS + 4}`);
  });

  it('leaves I02 request_user_input on its secret-safe legacy projection', () => {
    expect(selectTimelineActions(start('request_user_input', { questions: [] }), context)).toEqual([]);
    expect(selectTimelineActions({
      type: 'tool_execution_end', toolCallId: 'c1', toolName: 'request_user_input',
      result: { content: [{ type: 'text', text: 'secret answer' }], details: {} }, isError: false,
    } as PublicRuntimeEvent, context)).toEqual([]);
  });

  it.each(terminalActionCases())(
    'ignores late $actionType after a $turnStatus turn',
    ({ turnStatus, action }) => {
      const terminal = {
        ...applyEvents([start('tool', {}), end(false)]),
        status: turnStatus,
      } as TimelineTurn;
      expect(reduceTimeline(terminal, action)).toBe(terminal);
    },
  );
});

function terminalActionCases() {
  const owner = { sessionId: 's1', turnId: 'm1', at: 300 };
  const actions: TimelineAction[] = [
    {
      ...owner, type: 'requestApproval',
      item: {
        id: 'approval-late', requestId: 'approval-late', itemId: 'call-late',
        sessionId: 's1', turnId: 'm1', kind: 'approvalDecision', lane: 'decision',
        status: 'awaitingApproval', title: 'Approve late?', revision: 0,
        toolName: 'tool', arguments: {}, decisions: ['accept', 'decline', 'cancel'],
      },
    },
    { ...owner, type: 'settleApproval', requestId: 'approval-late', decision: 'accept' },
    { ...owner, type: 'update', id: 'c1', progress: { id: 'late', text: 'late', createdAt: 300 } },
    { ...owner, type: 'finish', id: 'c1', status: 'completed', title: 'Late finish' },
    {
      ...owner, type: 'addOutcome',
      item: {
        id: 'late-warning', sessionId: 's1', turnId: 'm1', kind: 'warning',
        lane: 'outcome', status: 'completed', title: 'Late', diagnostic: 'late', revision: 0,
      },
    },
  ];
  return (['completed', 'failed', 'interrupted'] as const).flatMap((turnStatus) => (
    actions.map((action) => ({ turnStatus, action, actionType: action.type }))
  ));
}

function applyEvents(events: PublicRuntimeEvent[]): TimelineTurn {
  let state: TimelineTurn | undefined;
  for (const event of events) {
    for (const action of selectTimelineActions(event, context)) state = reduceTimeline(state, action);
  }
  return state!;
}

function start(name: string, args: Record<string, unknown>): PublicRuntimeEvent {
  return { type: 'tool_execution_start', toolCallId: 'c1', toolName: name, args } as PublicRuntimeEvent;
}

function update(text: string): PublicRuntimeEvent {
  return {
    type: 'tool_execution_update', toolCallId: 'c1', toolName: 'tool', args: {},
    partialResult: { content: [{ type: 'text', text }], details: {} },
  } as PublicRuntimeEvent;
}

function end(isError: boolean, metadata?: Record<string, unknown>): PublicRuntimeEvent {
  return {
    type: 'tool_execution_end', toolCallId: 'c1', toolName: metadata?.command ? 'bash' : 'tool',
    result: { content: [{ type: 'text', text: isError ? 'failed' : 'done' }], details: { metadata } },
    isError,
  } as PublicRuntimeEvent;
}
