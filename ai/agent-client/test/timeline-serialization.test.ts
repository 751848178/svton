import { describe, expect, it } from 'vitest';
import { migrateLegacyMessageTimeline } from '../src/timeline/legacy-compatibility';
import { reduceTimeline } from '../src/timeline/lifecycle.reducer';
import { deserializeTimeline, serializeTimeline } from '../src/timeline/serialization';
import { createExecutionItem } from '../src/timeline/result-normalizer';
import {
  MAX_PROGRESS_ENTRIES,
  MAX_PROGRESS_TEXT,
  MAX_TIMELINE_ITEMS,
  MAX_TIMELINE_TEXT,
} from '../src/timeline/bounds';
import type { DisplayMessage, TimelineTurn } from '../src/types';

describe('timeline persistence', () => {
  it('round-trips progress/result/status/title/duration and keeps failed failed', () => {
    const owner = { sessionId: 's1', turnId: 'm1', at: 1 };
    let state = reduceTimeline(undefined, {
      ...owner,
      type: 'start',
      item: createExecutionItem({
        callId: 'c1', toolName: 'bash', arguments: { command: 'exit 7' }, ...owner,
      }),
    });
    state = reduceTimeline(state, {
      ...owner, type: 'update', id: 'c1', progress: { id: 'p1', text: 'working', createdAt: 1 },
    });
    state = reduceTimeline(state, {
      ...owner, at: 5, type: 'finish', id: 'c1', status: 'failed', title: 'Command failed',
      result: 'boom', retry: { kind: 'message', messageId: 'user-1' },
      command: {
        stderr: 'boom', exitCode: null, signal: 'SIGTERM', timedOut: false, durationMs: 4,
      },
    });
    state = reduceTimeline(state, { ...owner, at: 6, type: 'completeTurn', durationMs: 5 });
    const restored = deserializeTimeline(serializeTimeline(state), { now: 20 });
    expect(restored).toEqual(state);
    expect(restored?.items[0]).toMatchObject({
      status: 'failed', title: 'Command failed', durationMs: 4,
      progress: [{ text: 'working' }], result: 'boom',
      exitCode: null, signal: 'SIGTERM', timedOut: false,
      retry: { kind: 'message', messageId: 'user-1' },
    });
  });

  it('marks unproven live work interrupted on reload', () => {
    const state = reduceTimeline(undefined, {
      type: 'start', sessionId: 's1', turnId: 'm1', at: 1,
      item: createExecutionItem({
        callId: 'c1', toolName: 'tool', arguments: {}, sessionId: 's1', turnId: 'm1', at: 1,
      }),
    });
    expect(deserializeTimeline(state, { now: 10 })).toMatchObject({
      status: 'interrupted', items: [{ status: 'interrupted' }],
    });
  });

  it('migrates a legacy tool represented in both arrays exactly once', () => {
    const call = {
      id: 'c1', name: 'bash', arguments: { command: 'exit 7' }, status: 'error' as const,
      result: { callId: 'c1', output: 'boom', isError: true, metadata: { stderr: 'boom', exitCode: 7 } },
    };
    const message: DisplayMessage = {
      id: 'm1', role: 'assistant', content: '', timestamp: 1,
      toolCalls: [call], blocks: [{ type: 'tool_call', call }],
    };
    const timeline = migrateLegacyMessageTimeline(message, 's1');
    expect(timeline?.items).toHaveLength(1);
    expect(timeline?.items[0]).toMatchObject({ status: 'failed', stderr: 'boom', exitCode: 7 });
    expect(timeline?.items[0]).not.toHaveProperty('retry');
    expect(migrateLegacyMessageTimeline({ ...message, timeline }, 's1')).toBe(timeline);
  });

  it('drops malformed execution items without losing valid outcomes', () => {
    const stored = persistedTurn([
      {
        ...itemBase('bad-command', 'commandExecution'),
        kind: 'commandExecution', toolName: 'bash', command: 'pwd',
      },
      {
        ...itemBase('bad-tool', 'toolExecution'),
        kind: 'toolExecution', toolName: 'fetch', arguments: {}, progress: {},
      },
      {
        ...itemBase('warning-1', 'warning'),
        kind: 'warning', diagnostic: 'safe outcome',
      },
    ]);
    const restored = deserializeTimeline(stored, { live: true });
    expect(restored?.items).toEqual([
      expect.objectContaining({ id: 'warning-1', diagnostic: 'safe outcome' }),
    ]);
  });

  it('bounds and redacts persisted arguments and progress while preserving telemetry keys', () => {
    const rawProgressSecret = 'progress-secret-value';
    const progress = Array.from({ length: MAX_PROGRESS_ENTRIES + 5 }, (_, index) => ({
      id: `p-${index}`,
      text: `token=${rawProgressSecret} ${'x'.repeat(MAX_PROGRESS_TEXT + 20)}`,
      createdAt: index,
    }));
    const stored = persistedTurn([{
      ...itemBase('tool-1', 'toolExecution'),
      kind: 'toolExecution', toolName: 'fetch',
      arguments: {
        password: 'raw-password-value', tokenCount: 4, secretQuestionIds: ['q1'],
      },
      progress,
    }]);
    const persisted = serializeTimeline(stored as TimelineTurn);
    const restored = deserializeTimeline(persisted, { live: true });
    const serialized = JSON.stringify(persisted);
    expect(restored?.items[0]).toMatchObject({
      arguments: { tokenCount: 4, secretQuestionIds: ['q1'] },
    });
    expect((restored?.items[0] as { progress: unknown[] }).progress).toHaveLength(
      MAX_PROGRESS_ENTRIES,
    );
    expect((restored?.items[0] as { progress: Array<{ text: string }> }).progress[0]?.text.length)
      .toBeLessThanOrEqual(MAX_PROGRESS_TEXT);
    expect(serialized).not.toContain('raw-password-value');
    expect(serialized).not.toContain(rawProgressSecret);
  });

  it('serializes only the latest bounded timeline outcomes', () => {
    const items = Array.from({ length: MAX_TIMELINE_ITEMS + 5 }, (_, index) => ({
      ...itemBase(`warning-${index}`, 'warning'),
      kind: 'warning' as const,
      diagnostic: index === MAX_TIMELINE_ITEMS + 4
        ? 'x'.repeat(MAX_TIMELINE_TEXT + 100)
        : `warning ${index}`,
    }));
    const serialized = serializeTimeline(persistedTurn(items) as TimelineTurn) as TimelineTurn;
    expect(serialized.items).toHaveLength(MAX_TIMELINE_ITEMS);
    expect(serialized.items[0]?.id).toBe('warning-5');
    expect(serialized.items.at(-1)?.id).toBe(`warning-${MAX_TIMELINE_ITEMS + 4}`);
    expect((serialized.items.at(-1) as { diagnostic: string }).diagnostic.length)
      .toBeLessThanOrEqual(MAX_TIMELINE_TEXT);
  });

  it('never migrates request_user_input into the execution timeline', () => {
    const call = {
      id: 'input-1', name: 'request_user_input', arguments: { questions: [] },
      status: 'completed' as const,
      result: { callId: 'input-1', output: 'raw answer', isError: false },
    };
    const message: DisplayMessage = {
      id: 'm-input', role: 'assistant', content: '', timestamp: 1,
      toolCalls: [call], blocks: [{ type: 'tool_call', call }],
    };
    expect(migrateLegacyMessageTimeline(message, 's1')).toBeUndefined();
  });

  it('drops persisted request_user_input items during deserialization', () => {
    const owner = { sessionId: 's1', turnId: 'm-input', at: 1 };
    const stored = reduceTimeline(undefined, {
      ...owner,
      type: 'start',
      item: createExecutionItem({
        callId: 'input-1', toolName: 'request_user_input', arguments: {}, ...owner,
      }),
    });
    expect(deserializeTimeline(stored)).toBeUndefined();
  });
});

function persistedTurn(items: unknown[]): Record<string, unknown> {
  return {
    version: 1, sessionId: 's1', turnId: 'm1', status: 'completed', revision: 1, items,
  };
}

function itemBase(id: string, kind: string): Record<string, unknown> {
  return {
    id, kind, sessionId: 's1', turnId: 'm1', lane: 'outcome', status: 'failed',
    title: id, revision: 1,
  };
}
