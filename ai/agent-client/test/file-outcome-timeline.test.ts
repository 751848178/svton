import { describe, expect, it } from 'vitest';
import type { ToolResult } from '@svton/agent-core';
import { reduceTimeline } from '../src/timeline/lifecycle.reducer';
import {
  createFileOutcomeItem,
  normalizeFileOutcomeFinish,
} from '../src/timeline/file-outcome-normalizer';
import { deserializeTimeline, serializeTimeline } from '../src/timeline/serialization';
import type { TimelineAction, TimelineTerminalStatus, TimelineTurn } from '../src/timeline/types';
import { mergePersistedTimeline } from '../src/service/timeline-restore-merge';
import type { DisplayMessage } from '../src/types';

const owner = { sessionId: 's-file', turnId: 'turn-file', at: 1 };

describe('file outcome timeline', () => {
  it.each([
    ['completed', false, undefined],
    ['failed', true, undefined],
    ['declined', true, { approval: { decision: 'decline' } }],
  ] as const)('preserves exact %s status and source-backed payload', (status, isError, metadata) => {
    const result = toolResult('call-1', status === 'completed' ? '@@ -1 +1 @@' : 'not changed', isError, metadata);
    const state = finishOne(status, result);
    const item = state.items.find((candidate) => candidate.kind === 'fileOutcome');
    expect(item).toMatchObject({
      id: 'timeline:file:call:call-1',
      sessionId: 's-file',
      turnId: 'turn-file',
      kind: 'fileOutcome',
      scope: 'file',
      status,
      changes: [{ path: '/workspace/src/app.ts', changeType: 'modify', status }],
    });
    if (item?.kind !== 'fileOutcome') throw new Error('missing file outcome');
    if (status === 'completed') expect(item.changes[0]?.diff).toBe('@@ -1 +1 @@');
    else {
      expect(item.changes[0]?.diff).toBeUndefined();
      expect(item.detail).toBe('not changed');
    }
  });

  it('marks an unfinished file outcome interrupted without losing its path', () => {
    const start = startAction('call-1', '/workspace/src/app.ts');
    let state = reduceTimeline(undefined, start);
    state = reduceTimeline(state, { ...owner, at: 4, type: 'interruptTurn' });
    expect(state.items[0]).toMatchObject({
      status: 'interrupted', title: 'File change interrupted',
      changes: [{ path: '/workspace/src/app.ts', status: 'interrupted' }],
    });
    expect(deserializeTimeline(serializeTimeline(state), { live: true }))
      .toEqual(state);
  });

  it('replaces two file-scope items with one deterministic turn aggregate', () => {
    let state: TimelineTurn | undefined;
    for (const callId of ['call-1', 'call-2'] as const) {
      const path = '/same.ts';
      state = reduceTimeline(state, startAction(callId, path));
      state = reduceTimeline(state, finishAction(callId, 'completed', toolResult(callId, `diff ${path}`)));
    }
    state = reduceTimeline(state, { ...owner, at: 8, type: 'completeTurn' });
    const files = state.items.filter((item) => item.kind === 'fileOutcome');
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      id: 'timeline:file:turn:turn-file', scope: 'turn', status: 'completed',
      sourceCallIds: ['call-1', 'call-2'],
      changes: [
        { sourceCallId: 'call-1', path: '/same.ts' },
        { sourceCallId: 'call-2', path: '/same.ts' },
      ],
    });
  });

  it('round-trips a failed file outcome once and never turns it green', () => {
    let state = finishOne('failed', toolResult('call-1', 'permission denied', true));
    state = reduceTimeline(state, { ...owner, at: 9, type: 'completeTurn' });
    const restored = deserializeTimeline(serializeTimeline(state), { live: true });
    expect(restored).toEqual(state);
    expect(restored?.items.filter((item) => item.kind === 'fileOutcome')).toHaveLength(1);
    expect(restored?.items.find((item) => item.kind === 'fileOutcome')).toMatchObject({
      status: 'failed', detail: 'permission denied',
    });
  });

  it('restores an aggregate only when every stable source call identity matches', () => {
    const timeline = aggregateTurn();
    const persisted = messagesWithTimeline(timeline);
    const partial = mergePersistedTimeline(projectedMessages(['call-1']), persisted);
    expect((partial[1]?.timeline?.items ?? []).filter((item) => item.kind === 'fileOutcome'))
      .toHaveLength(0);
    const complete = mergePersistedTimeline(
      projectedMessages(['call-1', 'call-2']),
      persisted,
    );
    expect(complete[1]?.timeline?.items.filter((item) => item.kind === 'fileOutcome'))
      .toHaveLength(1);
  });

  it('suppresses checkpoint duplicates only for fully matched file outcomes', () => {
    const persisted = messagesWithTimeline(aggregateTurn());
    const projected = projectedMessages(['call-1', 'call-2']);
    projected[1] = {
      ...projected[1],
      timeline: aggregateTurn(),
    };
    projected.push({
      id: 'runtime-final', role: 'assistant', content: 'done', timestamp: 3,
      timeline: {
        version: 1, sessionId: 's-file', turnId: 'runtime-final',
        status: 'completed', items: [], revision: 1,
        usage: usageSnapshot(), usageResponseKeys: ['usage:runtime:final'],
      },
    });

    const merged = mergePersistedTimeline(projected, persisted);
    expect(merged.flatMap((message) => message.timeline?.items ?? [])
      .filter((item) => item.kind === 'fileOutcome')).toHaveLength(1);

    const partial = aggregateTurn();
    const partialFile = partial.items.find((item) => item.kind === 'fileOutcome');
    if (!partialFile || partialFile.kind !== 'fileOutcome') throw new Error('missing file outcome');
    projected[1] = {
      ...projected[1],
      timeline: {
        ...partial,
        items: [{ ...partialFile, sourceCallIds: ['call-1', 'unmatched-call'] }],
      },
    };
    const partialMerged = mergePersistedTimeline(projected, persisted);
    expect(partialMerged.flatMap((message) => message.timeline?.items ?? [])
      .filter((item) => item.kind === 'fileOutcome')).toHaveLength(2);
  });
});

function finishOne(status: TimelineTerminalStatus, result: ToolResult): TimelineTurn {
  let state = reduceTimeline(undefined, startAction(result.callId, '/workspace/src/app.ts'));
  state = reduceTimeline(state, finishAction(result.callId, status, result));
  return state;
}

function startAction(callId: string, path: string): TimelineAction {
  const item = createFileOutcomeItem({
    callId, toolName: 'file_edit', arguments: { path }, ...owner,
  });
  if (!item) throw new Error('expected file outcome');
  return { ...owner, type: 'start', item };
}

function finishAction(
  callId: string,
  status: TimelineTerminalStatus,
  result: ToolResult,
): TimelineAction {
  return {
    ...owner,
    type: 'finishFileOutcome',
    ...normalizeFileOutcomeFinish(callId, status, result),
  };
}

function toolResult(
  callId: string,
  output: string,
  isError = false,
  metadata?: Record<string, unknown>,
): ToolResult {
  return { callId, output, isError, metadata };
}

function aggregateTurn(): TimelineTurn {
  let state: TimelineTurn | undefined;
  for (const callId of ['call-1', 'call-2']) {
    state = reduceTimeline(state, startAction(callId, '/same.ts'));
    state = reduceTimeline(state, finishAction(
      callId,
      'completed',
      toolResult(callId, `diff ${callId}`),
    ));
  }
  return reduceTimeline(state, { ...owner, at: 8, type: 'completeTurn' });
}

function messagesWithTimeline(timeline: TimelineTurn): DisplayMessage[] {
  return [
    { id: 'saved-user', role: 'user', content: 'edit files', timestamp: 1 },
    { id: 'saved-assistant', role: 'assistant', content: '', timestamp: 2, timeline },
  ];
}

function projectedMessages(callIds: string[]): DisplayMessage[] {
  return [
    { id: 'runtime-user', role: 'user', content: 'edit files', timestamp: 1 },
    {
      id: 'runtime-assistant', role: 'assistant', content: '', timestamp: 2,
      toolCalls: callIds.map((id) => ({
        id, name: 'file_edit', arguments: { path: '/same.ts' }, status: 'completed',
      })),
    },
  ];
}

function usageSnapshot() {
  return {
    input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}
