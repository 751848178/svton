/**
 * Chat message-store helpers — pure functions that mutate the display
 * projection living on ChatService's observable properties.
 *
 * PI004/PI007 message-ownership: `messages` (active session) and
 * `sessionMessages` (background cache) are a strictly one-way DISPLAY
 * projection of runtime events. These helpers never write back to the runtime.
 *
 * The observable properties themselves live on ChatService (so the
 * @svton/service subscription layer sees them); this module owns the
 * transformation logic that keeps them in sync with events.
 */

import type { TokenUsage, ToolResult } from '@svton/agent-core';
import type { ChatStatus, DisplayMessage, PlanProgress } from '../types';
import { finalizeStalePendingApprovals, updateToolCallStatusInMessages } from './chat-message-tool-status.utils';

/**
 * The slice of ChatService that these helpers touch. Keeping it an interface
 * avoids a circular import and makes the helpers testable in isolation.
 */
export interface MessageStoreHost {
  messages: DisplayMessage[];
  sessionMessages: Map<string, DisplayMessage[]>;
  status: ChatStatus;
  lastUsage: TokenUsage | null;
  activePlan: PlanProgress | null;
  activeSessionId: string | null;
  backgroundSessionId: string | null;
}

/** True when the streaming session is the active (visible) session. */
export function isActiveSessionStreaming(host: MessageStoreHost): boolean {
  return host.backgroundSessionId === host.activeSessionId;
}

/** Apply a pure transform to whichever session is currently streaming. */
export function mapStreamingMessage(
  host: MessageStoreHost,
  fn: (m: DisplayMessage) => DisplayMessage,
): void {
  if (isActiveSessionStreaming(host)) {
    host.messages = host.messages.map(fn);
    return;
  }
  const bgId = host.backgroundSessionId;
  if (!bgId) return;
  const cached = host.sessionMessages.get(bgId);
  if (cached) host.sessionMessages.set(bgId, cached.map(fn));
}

/** Find the streaming assistant message in whichever session owns it. */
export function findStreamingMessage(
  host: MessageStoreHost,
  assistantMsgId: string,
): DisplayMessage | undefined {
  if (isActiveSessionStreaming(host)) {
    return host.messages.find((m) => m.id === assistantMsgId);
  }
  const bgId = host.backgroundSessionId;
  if (!bgId) return undefined;
  return host.sessionMessages.get(bgId)?.find((m) => m.id === assistantMsgId);
}

/** Update a tool call's status across the active list AND all background caches. */
export function updateToolCallStatusEverywhere(
  host: MessageStoreHost,
  callId: string,
  status: DisplayMessage['toolCalls'] extends (infer T)[] | undefined ? (T extends { status: infer S } ? S : never) : never,
  metadata?: Record<string, unknown>,
): void {
  host.messages = updateToolCallStatusInMessages(host.messages, callId, status, metadata);
  for (const [sessionId, msgs] of host.sessionMessages.entries()) {
    host.sessionMessages.set(sessionId, updateToolCallStatusInMessages(msgs, callId, status, metadata));
  }
}

/** Fold a planning tool result's planProgress into the active plan + a plan block. */
export function applyPlanProgressToStore(
  host: MessageStoreHost,
  result: ToolResult,
  assistantMsgId: string,
): void {
  if (result.isError || !result.metadata) return;
  const progress = result.metadata.planProgress as PlanProgress | undefined;
  if (!progress || !progress.planId || !Array.isArray(progress.steps)) return;

  host.activePlan = {
    planId: progress.planId,
    title: progress.title,
    steps: progress.steps,
  };

  mapStreamingMessage(host, (m) => {
    if (m.id !== assistantMsgId) return m;
    const blocks = [...(m.blocks || [])];
    const existingIdx = blocks.findIndex((b) => b.type === 'plan' && b.plan?.planId === progress.planId);
    const planBlock = {
      type: 'plan' as const,
      plan: { planId: progress.planId, title: progress.title, steps: progress.steps },
    };
    if (existingIdx >= 0) blocks[existingIdx] = planBlock;
    else blocks.push(planBlock);
    return { ...m, blocks };
  });
}

/** Mark every streaming assistant message as finalized (abort/shutdown). */
export function finalizeStreamingMessages(host: MessageStoreHost): void {
  host.messages = finalizeStalePendingApprovals(host.messages).map((m) =>
    m.isStreaming ? { ...m, isStreaming: false } : m,
  );
  const bgId = host.backgroundSessionId;
  if (bgId) {
    const cached = host.sessionMessages.get(bgId);
    if (cached) {
      host.sessionMessages.set(
        bgId,
        finalizeStalePendingApprovals(cached).map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
      );
    }
  }
}

/**
 * Abort teardown: finalize streaming messages, clear the background session
 * pointer, and idle the status. Returns the background session id that was
 * streaming (so the caller can fire onBackgroundStreamEnd if it differs from
 * the active session).
 */
export function abortStreaming(host: MessageStoreHost): string | null {
  finalizeStreamingMessages(host);
  const bgId = host.backgroundSessionId;
  host.backgroundSessionId = null;
  host.status = 'idle';
  return bgId;
}

/** Filter to savable messages (no streaming-in-progress, no system messages). */
export function messagesForSave(
  host: MessageStoreHost,
  sessionId?: string,
): DisplayMessage[] {
  const source = sessionId && sessionId !== host.activeSessionId
    ? (host.sessionMessages.get(sessionId) ?? [])
    : host.messages;
  return source.filter((m) => m.role !== 'system' && !m.isStreaming);
}

/** Force-prepare for shutdown flush: persist even in-progress messages. */
export function forceMessagesForSave(host: MessageStoreHost): DisplayMessage[] {
  const messages = host.messages.filter((m) => m.role !== 'system');
  return finalizeStalePendingApprovals(messages).map((m) => ({ ...m, isStreaming: false }));
}
