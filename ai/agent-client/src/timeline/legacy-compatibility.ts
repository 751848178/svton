import type { ContentBlock, DisplayMessage, DisplayToolCall } from '../types';
import { reduceTimeline } from './lifecycle.reducer';
import { createExecutionItem, normalizeToolOutcome } from './result-normalizer';
import { isTimelineEligibleTool } from './eligibility';
import { boundTimelineText } from './bounds';
import type { DiagnosticTimelineItem, TimelineAction, TimelineTurn } from './types';
import {
  createFileOutcomeItem,
  normalizeFileOutcomeFinish,
} from './file-outcome-normalizer';
import { contributionFromDisplay } from './usage-snapshot';

export function migrateLegacyMessageTimeline(
  message: DisplayMessage,
  sessionId = 'legacy',
): TimelineTurn | undefined {
  if (message.timeline || message.role !== 'assistant') return message.timeline;
  const turnId = message.id;
  const at = message.timestamp;
  const calls = collectCalls(message);
  const actions: TimelineAction[] = [];
  let hasInterrupted = false;
  const usage = contributionFromDisplay(message);
  if (usage) actions.push({
    sessionId, turnId, at, type: 'captureUsage', contributions: [usage],
  });

  for (const call of calls) {
    if (!isTimelineEligibleTool(call.name)) continue;
    const owner = { sessionId, turnId, at };
    actions.push({
      ...owner,
      type: 'start',
      item: createExecutionItem({
        callId: call.id,
        toolName: call.name,
        arguments: call.arguments,
        ...owner,
      }),
    });
    const file = createFileOutcomeItem({
      callId: call.id,
      toolName: call.name,
      arguments: call.arguments,
      ...owner,
    });
    if (file) actions.push({ ...owner, type: 'start', item: file });
    const result = legacyResult(call);
    const outcome = legacyOutcome(call, result);
    hasInterrupted ||= outcome.status === 'interrupted';
    actions.push({ ...owner, type: 'finish', id: call.id, ...outcome });
    if (file) {
      actions.push({
        ...owner,
        type: 'finishFileOutcome',
        ...normalizeFileOutcomeFinish(call.id, outcome.status, result),
      });
    }
  }

  const diagnostics = collectDiagnostics(message, sessionId, turnId, at);
  for (const item of diagnostics) actions.push({ sessionId, turnId, at, type: 'addOutcome', item });
  if (actions.length === 0) return undefined;

  const providerError = diagnostics.find((item) => item.kind === 'error');
  if (providerError) {
    actions.push({ sessionId, turnId, at, type: 'failTurn', item: providerError });
  } else if (hasInterrupted) {
    actions.push({ sessionId, turnId, at, type: 'interruptTurn' });
  } else {
    actions.push({ sessionId, turnId, at, type: 'completeTurn', durationMs: message.duration });
  }
  return actions.reduce(reduceTimeline, undefined);
}

function collectCalls(message: DisplayMessage): DisplayToolCall[] {
  const calls = new Map<string, DisplayToolCall>();
  for (const call of message.toolCalls ?? []) calls.set(call.id, call);
  for (const block of message.blocks ?? []) {
    if (block.type === 'tool_call') calls.set(block.call.id, block.call);
  }
  return [...calls.values()];
}

function legacyOutcome(call: DisplayToolCall, result: NonNullable<DisplayToolCall['result']>) {
  if (call.status === 'running' || call.status === 'pending_approval') {
    const output = result.output ? boundTimelineText(result.output) : undefined;
    return {
      status: 'interrupted' as const,
      title: `${call.name} interrupted`,
      summary: output,
      result: output,
    };
  }
  return normalizeToolOutcome(call.name, undefined, {
    ...result,
    isError: call.status === 'error' || result.isError,
  });
}

function legacyResult(call: DisplayToolCall): NonNullable<DisplayToolCall['result']> {
  return call.result ?? {
    callId: call.id,
    output: '',
    isError: call.status === 'error',
    metadata: call.metadata,
  };
}

function collectDiagnostics(
  message: DisplayMessage,
  sessionId: string,
  turnId: string,
  at: number,
): DiagnosticTimelineItem[] {
  const values = new Map<string, { kind: 'warning' | 'error'; text: string; code?: string }>();
  for (const block of message.blocks ?? []) addBlockDiagnostic(values, block);
  if (message.error) values.set(`error:${message.error}`, { kind: 'error', text: message.error });
  return [...values.values()].map(({ kind, text, code }, index) => ({
    id: `${turnId}:legacy-${kind}-${index}`,
    sessionId,
    turnId,
    kind,
    lane: 'outcome',
    status: kind === 'error' ? 'failed' : 'completed',
    title: kind === 'error' ? 'Provider error' : 'Warning',
    summary: boundTimelineText(text),
    diagnostic: boundTimelineText(text),
    code,
    startedAt: at,
    completedAt: at,
    revision: 0,
  }));
}

function addBlockDiagnostic(
  values: Map<string, { kind: 'warning' | 'error'; text: string; code?: string }>,
  block: ContentBlock,
): void {
  if (block.type === 'warning') {
    values.set(`warning:${block.text}`, { kind: 'warning', text: block.text, code: block.source });
  }
  if (block.type === 'error') values.set(`error:${block.text}`, { kind: 'error', text: block.text });
}
