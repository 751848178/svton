import { describe, expect, it } from 'vitest';
import type { AssistantMessage, Usage } from '@earendil-works/pi-ai';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import { reduceTimeline } from '../src/timeline/lifecycle.reducer';
import { selectTimelineActions } from '../src/timeline/public-event-selector';
import { contributionFromDisplay } from '../src/timeline/usage-snapshot';
import { deserializeTimeline, serializeTimeline } from '../src/timeline/serialization';
import { projectTimelineEvent } from '../src/service/chat-timeline-event-projection';
import { piMessagesToDisplay } from '../src/service/pi-message-display-boundary.utils';
import { mergePersistedTimeline } from '../src/service/timeline-restore-merge';
import type { MessageStoreHost } from '../src/service/chat-message-store';
import type { DisplayMessage } from '../src/types';
import type { TimelineTurn } from '../src/timeline/types';

const owner = { sessionId: 'session-a', turnId: 'turn-a', now: () => 100 };

describe('per-turn usage ownership', () => {
  it('aggregates every provider response once and keeps optional Pi fields exact', () => {
    const first = assistant('tool response', usage(10, 2, { cacheWrite1h: 3 }), 'response-a');
    const second = assistant('final response', usage(4, 6, { reasoning: 5 }), 'response-b');
    let state = apply(undefined, first);
    state = apply(state, first);
    state = apply(state, second);
    expect(state.usage).toEqual({
      input: 14, output: 8, cacheRead: 4, cacheWrite: 6,
      cacheWrite1h: 3, reasoning: 5, totalTokens: 32,
      cost: { input: 1.4, output: 0.8, cacheRead: 0.4, cacheWrite: 0.6, total: 3.2 },
    });
    expect(state.usageResponseKeys).toHaveLength(2);
    expect(JSON.stringify(state)).not.toContain('response-a');
  });

  it('uses agent_end only as a current-run fallback before terminal completion', () => {
    const messages = [
      assistant('tool response', usage(3, 1), 'one'),
      assistant('final response', usage(2, 4), 'two'),
    ];
    const actions = selectTimelineActions(
      { type: 'agent_end', messages } as never,
      owner,
    );
    const state = actions.reduce(reduceTimeline, undefined);
    expect(state.status).toBe('completed');
    expect(state.usage).toMatchObject({ input: 5, output: 5, totalTokens: 20 });
    const duplicateFallback = actions.reduce(reduceTimeline, state);
    expect(duplicateFallback).toBe(state);
  });

  it('keeps a bounded recent dedupe window without dropping later unique responses', () => {
    let state: TimelineTurn | undefined;
    for (let index = 0; index < 129; index += 1) {
      state = apply(state, assistant(`response ${index}`, usage(1, 0), `response-${index}`));
    }
    expect(state?.usage?.input).toBe(129);
    expect(state?.usageResponseKeys).toHaveLength(128);
    const duplicateLatest = apply(state, assistant('response 128', usage(1, 0), 'response-128'));
    expect(duplicateLatest).toBe(state);
  });

  it('rejects malformed usage and safely round-trips a usage-only turn', () => {
    const state = apply(undefined, assistant('done', usage(7, 3), 'valid'));
    const completed = reduceTimeline(state, {
      type: 'completeTurn', sessionId: 'session-a', turnId: 'turn-a', at: 101,
    });
    expect(deserializeTimeline(serializeTimeline(completed), { live: true })).toEqual(completed);
    expect(completed.items).toEqual([]);
    expect(deserializeTimeline({
      ...completed, usage: { ...completed.usage, input: -1 },
    }, { live: true })).toBeUndefined();
    expect(deserializeTimeline({
      ...completed, usage: { ...completed.usage, output: 1.5 },
    }, { live: true })).toBeUndefined();
    expect(deserializeTimeline({
      ...completed, usage: { ...completed.usage, cost: { ...completed.usage?.cost, total: Infinity } },
    }, { live: true })).toBeUndefined();
  });

  it('hashes oversized and cyclic fallback identity with a bounded traversal', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const prefix = 'x'.repeat(100_000);
    const first = displayUsage(`${prefix}A`, cyclic);
    const second = displayUsage(`${prefix}B`, cyclic);
    const a = contributionFromDisplay(first);
    const b = contributionFromDisplay(second);
    expect(a?.responseKey).toMatch(/^usage:[0-9a-z]+:[0-9a-z]+$/);
    expect(b?.responseKey).not.toBe(a?.responseKey);
    expect(JSON.stringify(a)).not.toContain(prefix.slice(0, 100));
  });

  it('routes reverse-order session events to their owning cache only', () => {
    const host = messageHost();
    const usageB = assistant('B', usage(20, 2), 'b');
    const addressB = { sessionId: 'session-b', runId: 'run-b' };
    projectTimelineEvent({ type: 'message_end', message: usageB } as never, 'assistant-b', host, addressB);
    projectTimelineEvent({ type: 'agent_end', messages: [usageB] } as never, 'assistant-b', host, addressB);
    expect(host.lastUsage).toBeNull();
    const usageA = assistant('A', usage(10, 1), 'a');
    const addressA = { sessionId: 'session-a', runId: 'run-a' };
    projectTimelineEvent({ type: 'message_end', message: usageA } as never, 'assistant-a', host, addressA);
    projectTimelineEvent({ type: 'agent_end', messages: [usageA] } as never, 'assistant-a', host, addressA);
    expect(host.messages[1]?.timeline?.usage?.input).toBe(10);
    expect(host.sessionMessages.get('session-b')?.[1]?.timeline?.usage?.input).toBe(20);
    expect(host.lastUsage?.input).toBe(10);
  });

  it('coalesces checkpoint responses and keeps saved normalized usage authoritative', () => {
    const projected = piMessagesToDisplay(checkpointMessages());
    const assistants = projected.filter((message) => message.role === 'assistant');
    expect(assistants[0]?.timeline?.usage).toBeUndefined();
    expect(assistants[1]?.timeline?.usage).toMatchObject({ input: 12, output: 4 });

    const savedTimeline = savedExecutionTimeline();
    const persisted: DisplayMessage[] = [
      { id: 'saved-user', role: 'user', content: 'run tool', timestamp: 1 },
      { id: 'saved-assistant', role: 'assistant', content: 'final', timestamp: 2, timeline: savedTimeline },
    ];
    const merged = mergePersistedTimeline(projected, persisted);
    const usageOwners = merged.filter((message) => message.timeline?.usage);
    expect(usageOwners).toHaveLength(1);
    expect(usageOwners[0]?.timeline?.usage).toMatchObject({ input: 99, output: 9 });
    expect(usageOwners[0]?.timeline?.items.some((item) => item.id === 'call-1')).toBe(true);
  });

  it('preserves checkpoint usage when a legacy saved execution has none', () => {
    const projected = piMessagesToDisplay(checkpointMessages().slice(0, 3));
    const saved = savedExecutionTimeline();
    const { usage: _usage, usageResponseKeys: _keys, ...legacySaved } = saved;
    const persisted: DisplayMessage[] = [
      { id: 'saved-user', role: 'user', content: 'run tool', timestamp: 1 },
      { id: 'saved-assistant', role: 'assistant', content: '', timestamp: 2, timeline: legacySaved },
    ];
    const merged = mergePersistedTimeline(projected, persisted);
    expect(merged.filter((message) => message.timeline?.usage)).toHaveLength(1);
    expect(merged.find((message) => message.timeline?.usage)?.timeline?.usage)
      .toMatchObject({ input: 10, output: 1 });
  });
});

function apply(current: TimelineTurn | undefined, message: AssistantMessage): TimelineTurn {
  return selectTimelineActions({ type: 'message_end', message } as never, owner)
    .reduce(reduceTimeline, current);
}

function usage(
  input: number,
  output: number,
  optional: Partial<Pick<Usage, 'cacheWrite1h' | 'reasoning'>> = {},
): Usage {
  return {
    input, output, cacheRead: 2, cacheWrite: 3,
    ...optional,
    totalTokens: input + output + 5,
    cost: {
      input: input / 10, output: output / 10,
      cacheRead: 0.2, cacheWrite: 0.3,
      total: (input + output + 5) / 10,
    },
  };
}

function assistant(text: string, value: Usage, responseId?: string): AssistantMessage {
  return {
    role: 'assistant', content: [{ type: 'text', text }], api: 'openai-responses',
    provider: 'openai', model: 'test', responseId, usage: value,
    stopReason: 'stop', timestamp: 10,
  };
}

function displayUsage(content: string, argumentsValue: Record<string, unknown>): DisplayMessage {
  return {
    id: content.slice(-1), role: 'assistant', content, timestamp: 10,
    metadata: { api: 'test', provider: 'test', model: 'test', usage: usage(1, 1) },
    toolCalls: [{ id: 'call', name: 'shell', arguments: argumentsValue, status: 'completed' }],
  };
}

function messageHost(): MessageStoreHost {
  return {
    activeSessionId: 'session-a', backgroundSessionId: null,
    messages: [
      { id: 'user-a', role: 'user', content: 'A', timestamp: 1 },
      { id: 'assistant-a', role: 'assistant', content: '', timestamp: 2 },
    ],
    sessionMessages: new Map([['session-b', [
      { id: 'user-b', role: 'user', content: 'B', timestamp: 1 },
      { id: 'assistant-b', role: 'assistant', content: '', timestamp: 2 },
    ]]]),
    status: 'running', lastUsage: null, activePlan: null,
  };
}

function checkpointMessages(): AgentMessage[] {
  return [
    { role: 'user', content: 'run tool', timestamp: 1 },
    {
      ...assistant('tool', usage(10, 1), 'checkpoint-one'),
      content: [{ type: 'toolCall', id: 'call-1', name: 'shell', arguments: { command: 'true' } }],
      stopReason: 'toolUse',
    },
    {
      role: 'toolResult', toolCallId: 'call-1', toolName: 'shell',
      content: [{ type: 'text', text: 'ok' }], isError: false, timestamp: 2,
    },
    assistant('final', usage(2, 3), 'checkpoint-two'),
  ];
}

function savedExecutionTimeline(): TimelineTurn {
  return {
    version: 1, sessionId: 'session-a', turnId: 'saved-assistant', status: 'completed',
    usage: usage(99, 9), usageResponseKeys: ['usage:saved:owner'],
    items: [{
      id: 'call-1', sessionId: 'session-a', turnId: 'saved-assistant',
      kind: 'commandExecution', lane: 'outcome', status: 'completed', title: 'shell completed',
      toolName: 'shell', progress: [], result: 'ok', revision: 1,
    }],
    revision: 2,
  };
}
