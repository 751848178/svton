import { describe, expect, it } from 'vitest';
import type {
  ToolApprovalRequest,
  ToolApprovalSettlementDecision,
} from '@svton/agent-core';
import { reduceTimeline } from '../src/timeline/lifecycle.reducer';
import { selectTimelineActions } from '../src/timeline/public-event-selector';
import { deserializeTimeline, serializeTimeline } from '../src/timeline/serialization';
import type { TimelineTurn } from '../src/timeline/types';

const request: ToolApprovalRequest = {
  requestId: 'approval:call-1:1',
  sessionId: 'default',
  itemId: 'call-1',
  createdAt: 1,
  toolName: 'deploy',
  arguments: { apiKey: '[REDACTED]', target: 'staging' },
  decisions: ['accept', 'acceptForSession', 'decline', 'cancel'],
};
const context = { sessionId: 'local', turnId: 'message-1', now: () => 9 };

describe('approval decision timeline', () => {
  it('uses the event canonical session even when the generic context is local', () => {
    const [action] = selectTimelineActions({ type: 'tool_approval_needed', request }, context);
    const state = reduceTimeline(undefined, action);
    expect(state).toMatchObject({
      sessionId: 'default',
      items: [{
        kind: 'approvalDecision', requestId: request.requestId,
        lane: 'decision', status: 'awaitingApproval',
      }],
    });
  });

  it.each([
    ['accept', 'completed'],
    ['acceptForSession', 'completed'],
    ['decline', 'declined'],
    ['cancel', 'cancelled'],
    ['interrupted', 'interrupted'],
  ] as Array<[ToolApprovalSettlementDecision, string]>)('%s retains non-actionable %s history', (
    decision,
    status,
  ) => {
    const [requested] = selectTimelineActions({ type: 'tool_approval_needed', request }, context);
    let state = reduceTimeline(undefined, requested);
    const [settled] = selectTimelineActions({
      type: 'tool_approval_settled',
      settlement: {
        requestId: request.requestId, sessionId: 'default', itemId: 'call-1',
        decision, settledAt: 5,
      },
    }, context);
    state = reduceTimeline(state, settled);
    expect(state.items[0]).toMatchObject({ lane: 'outcome', status, decision });
    expect(state.items[0].status).not.toBe('failed');
  });

  it('reloads a valid pending request as interrupted and never actionable', () => {
    const [action] = selectTimelineActions({ type: 'tool_approval_needed', request }, context);
    const pending = reduceTimeline(undefined, action);
    const restored = deserializeTimeline(serializeTimeline(pending), { now: 10 });
    expect(restored).toMatchObject({
      status: 'interrupted',
      items: [{ lane: 'outcome', status: 'interrupted', decision: 'interrupted' }],
    });
  });

  it.each([
    ['decision', 'awaitingApproval', 'accept'],
    ['outcome', 'awaitingApproval', undefined],
    ['outcome', 'completed', 'decline'],
    ['outcome', 'declined', 'cancel'],
    ['outcome', 'cancelled', 'interrupted'],
    ['outcome', 'interrupted', undefined],
    ['process', 'completed', 'accept'],
  ])('rejects malformed lane=%s status=%s decision=%s', (lane, status, decision) => {
    const malformed = persistedApproval({ lane, status, decision });
    expect(deserializeTimeline(malformed, { live: true })).toBeUndefined();
  });

  it('rejects a terminal turn containing an otherwise valid actionable approval', () => {
    const malformed = persistedApproval({
      lane: 'decision', status: 'awaitingApproval', decision: undefined,
    });
    expect(deserializeTimeline(malformed, { live: true })).toBeUndefined();
  });
});

function persistedApproval(overrides: Record<string, unknown>): TimelineTurn {
  return {
    version: 1, sessionId: 'default', turnId: 'message-1', status: 'completed',
    revision: 1, items: [{
      id: request.requestId, requestId: request.requestId, itemId: request.itemId,
      sessionId: 'default', turnId: 'message-1', kind: 'approvalDecision',
      lane: 'outcome', status: 'completed', title: 'Approved deploy', revision: 1,
      toolName: 'deploy', arguments: {}, decisions: request.decisions, decision: 'accept',
      ...overrides,
    }],
  } as TimelineTurn;
}
