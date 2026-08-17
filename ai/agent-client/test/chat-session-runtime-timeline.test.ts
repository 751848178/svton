import { describe, expect, it, vi } from 'vitest';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import {
  RUNTIME_SKILL_CONTEXT_PREFIX,
  type SerializedRuntime,
  type SvtonAgentRuntime,
} from '@svton/agent-core';
import { ChatSessionRuntimeService } from '../src/service/chat-session-runtime.service';
import { piMessagesToDisplay } from '../src/service/pi-message-display-boundary.utils';
import type { DisplayMessage } from '../src/types';
import type { TimelineTurn } from '../src/timeline/types';
import { fauxAssistantMessage, fauxText, fauxToolCall } from './helpers/pi-test-utils';

describe('canonical runtime timeline restore', () => {
  it('merges a persisted timeline only after a valid canonical checkpoint', async () => {
    const canonical: AgentMessage[] = [
      { role: 'user', content: 'run', timestamp: 1 },
      withTimestamp(fauxAssistantMessage([fauxText('done')]), 2),
    ];
    const timeline = completedTimeline();
    const persisted: DisplayMessage[] = [
      { id: 'saved-u', role: 'user', content: 'run', timestamp: 1 },
      { id: 'saved-a', role: 'assistant', content: 'done', timestamp: 2, timeline },
    ];
    const runtime = runtimeWithCheckpoint(canonical);

    const restored = await new ChatSessionRuntimeService().restore(
      runtime, 's1', persisted, () => true,
    );

    expect(restored?.[1]).toMatchObject({ id: 'saved-a', timeline });
    expect(restored?.[0]).toMatchObject({ id: 'saved-u', runtimeMessageIndex: 0 });
  });

  it('keeps empty-checkpoint semantics even when display history exists', async () => {
    const runtime = runtimeWithCheckpoint(null);
    const persisted: DisplayMessage[] = [
      { id: 'stale', role: 'user', content: 'display only', timestamp: 1 },
    ];
    await expect(new ChatSessionRuntimeService().restore(
      runtime, 's1', persisted, () => true,
    )).resolves.toEqual([]);
    expect(runtime.reset).toHaveBeenCalledOnce();
  });

  it('restores terminal interrupted approval history without reviving runtime state', async () => {
    const runtime = runtimeWithCheckpoint(null);
    const persisted: DisplayMessage[] = [
      { id: 'saved-u', role: 'user', content: 'approve', timestamp: 1 },
      {
        id: 'saved-a', role: 'assistant', content: '', timestamp: 2,
        timeline: interruptedApprovalTimeline(),
      },
    ];

    const restored = await new ChatSessionRuntimeService().restore(
      runtime, 's1', persisted, () => true,
    );

    expect(restored).toEqual(persisted);
    expect(runtime.getMessages()).toEqual([]);
    expect(runtime.reset).toHaveBeenCalledOnce();
  });

  it('appends an interrupted approval turn newer than the canonical checkpoint', async () => {
    const canonical: AgentMessage[] = [
      { role: 'user', content: 'first turn', timestamp: 1 },
      withTimestamp(fauxAssistantMessage([fauxText('first done')]), 2),
    ];
    const runtime = runtimeWithCheckpoint(canonical);
    const persisted: DisplayMessage[] = [
      { id: 'first-u', role: 'user', content: 'first turn', timestamp: 1 },
      { id: 'first-a', role: 'assistant', content: 'first done', timestamp: 2 },
      { id: 'approval-u', role: 'user', content: 'approve next', timestamp: 3 },
      {
        id: 'approval-a', role: 'assistant', content: '', timestamp: 4,
        timeline: interruptedApprovalTimeline(),
      },
    ];

    const restored = await new ChatSessionRuntimeService().restore(
      runtime, 's1', persisted, () => true,
    );

    expect(restored?.map((message) => message.content)).toEqual([
      'first turn', 'first done', 'approve next', '',
    ]);
    expect(restored?.at(-1)?.timeline?.items[0]).toMatchObject({
      kind: 'approvalDecision', status: 'interrupted', decision: 'interrupted',
    });
    expect(runtime.getMessages()).toEqual(canonical);
  });

  it('matches two persisted tool timelines by call id within each user turn', async () => {
    const firstCall = fauxToolCall('bash', { command: 'one' });
    const secondCall = fauxToolCall('bash', { command: 'two' });
    const canonical: AgentMessage[] = [
      { role: 'user', content: 'first', timestamp: 1 },
      withTimestamp(fauxAssistantMessage([firstCall]), 2),
      toolResult(firstCall.id, 'one', 3),
      withTimestamp(fauxAssistantMessage([fauxText('first done')]), 4),
      { role: 'user', content: 'second', timestamp: 5 },
      withTimestamp(fauxAssistantMessage([secondCall]), 6),
      toolResult(secondCall.id, 'two', 7),
      withTimestamp(fauxAssistantMessage([fauxText('second done')]), 8),
    ];
    const persisted: DisplayMessage[] = [
      { id: 'u1', role: 'user', content: 'first', timestamp: 1 },
      { id: 'a1', role: 'assistant', content: 'first done', timestamp: 4, timeline: toolTimeline(firstCall.id, 'a1') },
      { id: 'u2', role: 'user', content: 'second', timestamp: 5 },
      { id: 'a2', role: 'assistant', content: 'second done', timestamp: 8, timeline: toolTimeline(secondCall.id, 'a2') },
    ];

    const restored = await new ChatSessionRuntimeService().restore(
      runtimeWithCheckpoint(canonical), 's1', persisted, () => true,
    );
    const timelineIds = restored?.flatMap((message) => (
      message.timeline?.items.map((item) => item.id) ?? []
    ));
    expect(timelineIds).toEqual([firstCall.id, secondCall.id]);
  });

  it('renders each execution once when one live turn spans two canonical tool cycles', async () => {
    const firstCall = fauxToolCall('bash', { command: 'one' });
    const secondCall = fauxToolCall('bash', { command: 'two' });
    const canonical: AgentMessage[] = [
      { role: 'user', content: 'run both', timestamp: 1 },
      withTimestamp(fauxAssistantMessage([firstCall]), 2),
      toolResult(firstCall.id, 'one', 3),
      withTimestamp(fauxAssistantMessage([secondCall]), 4),
      toolResult(secondCall.id, 'two', 5),
      withTimestamp(fauxAssistantMessage([fauxText('both done')]), 6),
    ];
    const persisted: DisplayMessage[] = [
      { id: 'u1', role: 'user', content: 'run both', timestamp: 1 },
      {
        id: 'a1', role: 'assistant', content: 'both done', timestamp: 6,
        timeline: multiToolTimeline([firstCall.id, secondCall.id], 'a1'),
      },
    ];

    const restored = await new ChatSessionRuntimeService().restore(
      runtimeWithCheckpoint(canonical), 's1', persisted, () => true,
    );
    const projectedIds = restored?.flatMap(executionProjectionIds) ?? [];
    expect(projectedIds.filter((id) => id === firstCall.id)).toHaveLength(1);
    expect(projectedIds.filter((id) => id === secondCall.id)).toHaveLength(1);
    expect(restored?.find((message) => message.timeline)).toMatchObject({ id: 'a1' });
  });

  it('does not revive a persisted execution with no canonical toolCallId', async () => {
    const canonical: AgentMessage[] = [
      { role: 'user', content: 'plain turn', timestamp: 1 },
      withTimestamp(fauxAssistantMessage([fauxText('done')]), 2),
    ];
    const persisted: DisplayMessage[] = [
      { id: 'u1', role: 'user', content: 'plain turn', timestamp: 1 },
      {
        id: 'stale-a', role: 'assistant', content: 'stale', timestamp: 2,
        timeline: toolTimeline('missing-call', 'stale-a'),
      },
    ];
    const restored = await new ChatSessionRuntimeService().restore(
      runtimeWithCheckpoint(canonical), 's1', persisted, () => true,
    );
    expect(restored?.flatMap(executionProjectionIds)).not.toContain('missing-call');
    expect(restored?.some((message) => message.id === 'stale-a')).toBe(false);
  });

  it('keeps only exact partial execution matches and drops unproven diagnostics', async () => {
    const call = fauxToolCall('bash', { command: 'one' });
    const canonical: AgentMessage[] = [
      { role: 'user', content: 'run one', timestamp: 1 },
      withTimestamp(fauxAssistantMessage([call]), 2),
      toolResult(call.id, 'one', 3),
      withTimestamp(fauxAssistantMessage([fauxText('done')]), 4),
    ];
    const persisted: DisplayMessage[] = [
      { id: 'different-u', role: 'user', content: 'different prompt', timestamp: 99 },
      {
        id: 'partial-a', role: 'assistant', content: 'done', timestamp: 4,
        timeline: mixedTimeline(call.id, 'missing-call', 'partial-a'),
      },
    ];
    const restored = await new ChatSessionRuntimeService().restore(
      runtimeWithCheckpoint(canonical), 's1', persisted, () => true,
    );
    expect(restored?.flatMap(executionProjectionIds).filter((id) => id === call.id))
      .toHaveLength(1);
    expect(restored?.flatMap(executionProjectionIds)).not.toContain('missing-call');
    expect(restored?.find((message) => message.timeline)?.timeline?.items.map((item) => item.id))
      .toEqual([call.id]);
  });

  it('skips injected skill context and globally restores the real tool outcome', async () => {
    const call = fauxToolCall('bash', { command: 'exit 7' });
    const canonical: AgentMessage[] = [
      {
        role: 'user',
        content: `${RUNTIME_SKILL_CONTEXT_PREFIX}\n### Skill: verify-before-done\nInstructions`,
        timestamp: 1,
      },
      { role: 'user', content: 'run failing fixture', timestamp: 20 },
      withTimestamp(fauxAssistantMessage([call]), 3),
      toolResult(call.id, 'fatal stderr', 4),
      withTimestamp(fauxAssistantMessage([fauxText('failure observed')]), 5),
    ];
    const timeline = failedCommandTimeline(call.id, 'saved-a');
    const persisted: DisplayMessage[] = [
      { id: 'saved-u', role: 'user', content: 'run failing fixture', timestamp: 2 },
      {
        id: 'saved-a', role: 'assistant', content: 'failure observed', timestamp: 5,
        duration: 27, timeline,
      },
    ];

    const restored = await new ChatSessionRuntimeService().restore(
      runtimeWithCheckpoint(canonical), 's1', persisted, () => true,
    );

    expect(restored?.filter((message) => message.role === 'user')).toEqual([
      expect.objectContaining({
        id: 'saved-u', content: 'run failing fixture', runtimeMessageIndex: 1,
      }),
    ]);
    expect(JSON.stringify(restored)).not.toContain(RUNTIME_SKILL_CONTEXT_PREFIX);
    const restoredOutcome = restored?.find((message) => message.timeline);
    expect(restoredOutcome).toMatchObject({ id: 'saved-a', duration: 27 });
    expect(restoredOutcome?.timeline?.items[0]).toMatchObject({
      id: call.id, status: 'failed', stderr: 'fatal stderr', exitCode: 7, durationMs: 23,
    });
  });

  it('keeps normal user text that is not the reserved injected prefix', () => {
    const display = piMessagesToDisplay([{
      role: 'user',
      content: `Please explain ${RUNTIME_SKILL_CONTEXT_PREFIX}`,
      timestamp: 1,
    }]);
    expect(display).toEqual([
      expect.objectContaining({ role: 'user', content: `Please explain ${RUNTIME_SKILL_CONTEXT_PREFIX}` }),
    ]);
  });

  it('matches duplicate logical users one-to-one in order despite timestamp drift', async () => {
    const canonical: AgentMessage[] = [
      { role: 'user', content: 'repeat', timestamp: 10 },
      withTimestamp(fauxAssistantMessage([fauxText('first')]), 11),
      { role: 'user', content: 'repeat', timestamp: 20 },
      withTimestamp(fauxAssistantMessage([fauxText('second')]), 21),
    ];
    const persisted: DisplayMessage[] = [
      { id: 'saved-first', role: 'user', content: 'repeat', timestamp: 12 },
      { id: 'saved-second', role: 'user', content: 'repeat', timestamp: 22 },
    ];
    const restored = await new ChatSessionRuntimeService().restore(
      runtimeWithCheckpoint(canonical), 's1', persisted, () => true,
    );
    expect(restored?.filter((message) => message.role === 'user').map((message) => message.id))
      .toEqual(['saved-first', 'saved-second']);
  });

  it('uses timestamp only to prefer among otherwise identical unmatched users', async () => {
    const canonical: AgentMessage[] = [
      { role: 'user', content: 'repeat', timestamp: 10 },
      withTimestamp(fauxAssistantMessage([fauxText('first')]), 11),
      { role: 'user', content: 'repeat', timestamp: 20 },
      withTimestamp(fauxAssistantMessage([fauxText('second')]), 21),
    ];
    const persisted: DisplayMessage[] = [
      { id: 'saved-second', role: 'user', content: 'repeat', timestamp: 20 },
    ];
    const restored = await new ChatSessionRuntimeService().restore(
      runtimeWithCheckpoint(canonical), 's1', persisted, () => true,
    );
    const users = restored?.filter((message) => message.role === 'user') ?? [];
    expect(users[0]?.id).not.toBe('saved-second');
    expect(users[1]?.id).toBe('saved-second');
  });

  it('restores structured answers without raw values, action, or execution timeline item', () => {
    const assistant = withTimestamp(fauxAssistantMessage([fauxToolCall(
      'request_user_input',
      { questions: [{ id: 'token', isSecret: true }, { id: 'theme', isSecret: false }] },
    )]), 1);
    const display = piMessagesToDisplay([
      assistant,
      {
        role: 'toolResult', toolCallId: assistant.content[0].id,
        toolName: 'request_user_input',
        content: [{
          type: 'text',
          text: JSON.stringify({ answers: {
            token: { answers: ['canonical-secret'] },
            theme: { answers: ['Blue'] },
          } }),
        }],
        details: { metadata: { containsSecret: true, secretQuestionIds: ['token'] } },
        isError: false,
        timestamp: 2,
      },
    ]);

    const restored = JSON.stringify(display);
    expect(restored).not.toContain('canonical-secret');
    expect(restored).not.toContain('Blue');
    expect(display[0].toolCalls?.[0].result).toMatchObject({
      output: 'Structured user input submitted.',
      metadata: { structuredUserInput: true },
    });
    expect(display[0].timeline).toMatchObject({
      usage: { input: 0, output: 0, totalTokens: 0 },
      items: [],
    });
    expect(restored).not.toContain('userInputRequest');
  });
});

function runtimeWithCheckpoint(messages: AgentMessage[] | null): SvtonAgentRuntime {
  let canonical = messages ?? [];
  const checkpoint: SerializedRuntime | null = messages ? {
    messages, model: 'test-model', updatedAt: 1,
  } : null;
  const runtime = {
    getResumeManager: () => ({
      load: vi.fn().mockResolvedValue(checkpoint),
      applyLoadedState: vi.fn((state: SerializedRuntime) => { canonical = state.messages; }),
    }),
    getMessages: () => canonical,
    getCanonicalMessages: () => canonical,
    reset: vi.fn(() => { canonical = []; }),
  };
  return runtime as unknown as SvtonAgentRuntime;
}

function withTimestamp<T extends { timestamp: number }>(message: T, timestamp: number): T {
  return { ...message, timestamp };
}

function completedTimeline(): TimelineTurn {
  return {
    version: 1, sessionId: 's1', turnId: 'saved-a', status: 'completed',
    items: [{
      id: 'warning-1', sessionId: 's1', turnId: 'saved-a', kind: 'warning',
      lane: 'outcome', status: 'completed', title: 'Warning', diagnostic: 'kept', revision: 0,
    }],
    revision: 1,
  };
}

function interruptedApprovalTimeline(): TimelineTurn {
  return {
    version: 1, sessionId: 's1', turnId: 'saved-a', status: 'interrupted', revision: 2,
    items: [{
      id: 'approval-1', requestId: 'approval-1', itemId: 'call-1',
      sessionId: 's1', turnId: 'saved-a', kind: 'approvalDecision',
      lane: 'outcome', status: 'interrupted', decision: 'interrupted',
      title: 'Approval interrupted', revision: 1, toolName: 'e2e_approval',
      arguments: {}, decisions: ['accept', 'decline', 'cancel'], completedAt: 3,
    }],
  };
}

function toolResult(callId: string, output: string, timestamp: number): AgentMessage {
  return {
    role: 'toolResult', toolCallId: callId, toolName: 'bash',
    content: [{ type: 'text', text: output }], details: {}, isError: false, timestamp,
  };
}

function toolTimeline(callId: string, turnId: string): TimelineTurn {
  return {
    version: 1, sessionId: 's1', turnId, status: 'completed',
    items: [{
      id: callId, sessionId: 's1', turnId, kind: 'commandExecution', toolName: 'bash',
      arguments: {}, progress: [], lane: 'outcome', status: 'completed',
      title: 'Command completed', revision: 1,
    }],
    revision: 1,
  };
}

function failedCommandTimeline(callId: string, turnId: string): TimelineTurn {
  return {
    version: 1, sessionId: 's1', turnId, status: 'completed',
    items: [{
      id: callId, sessionId: 's1', turnId, kind: 'commandExecution', toolName: 'bash',
      progress: [], lane: 'outcome', status: 'failed', title: 'Command failed',
      command: '[REDACTED:credential]', stderr: 'fatal stderr', exitCode: 7,
      durationMs: 23, revision: 1,
    }],
    revision: 1,
  };
}

function multiToolTimeline(callIds: string[], turnId: string): TimelineTurn {
  return {
    version: 1, sessionId: 's1', turnId, status: 'completed',
    items: callIds.map((id) => ({
      id, sessionId: 's1', turnId, kind: 'commandExecution' as const, toolName: 'bash',
      progress: [], lane: 'outcome' as const, status: 'completed' as const,
      title: 'Command completed', revision: 1,
    })),
    revision: 1,
  };
}

function executionProjectionIds(message: DisplayMessage): string[] {
  const timeline = message.timeline?.items.flatMap((item) => (
    item.kind === 'toolExecution' || item.kind === 'commandExecution' ? [item.id] : []
  )) ?? [];
  const calls = message.toolCalls?.map((call) => call.id) ?? [];
  const blocks = message.blocks?.flatMap((block) => (
    block.type === 'tool_call' ? [block.call.id] : []
  )) ?? [];
  return [...timeline, ...calls, ...blocks];
}

function mixedTimeline(matchedId: string, staleId: string, turnId: string): TimelineTurn {
  const timeline = multiToolTimeline([matchedId, staleId], turnId);
  timeline.items.push({
    id: 'stale-diagnostic', sessionId: 's1', turnId, kind: 'error',
    lane: 'outcome', status: 'failed', title: 'Provider error',
    diagnostic: 'unproven stale error', revision: 1,
  });
  return timeline;
}
