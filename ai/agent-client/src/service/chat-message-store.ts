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

import type { Usage } from '@earendil-works/pi-ai';
import type { ChatStatus, DisplayMessage, PlanProgress } from '../types';
import { finalizeStalePendingApprovals } from './chat-message-tool-status.utils';
import { interruptMessageTimeline } from '../timeline/message-projection';

/**
 * The slice of ChatService that these helpers touch. Keeping it an interface
 * avoids a circular import and makes the helpers testable in isolation.
 */
export interface MessageStoreHost {
  messages: DisplayMessage[];
  sessionMessages: Map<string, DisplayMessage[]>;
  status: ChatStatus;
  lastUsage: Usage | null;
  activePlan: PlanProgress | null;
  activeSessionId: string | null;
  /** Legacy injected-event hint only; real runtime routing always supplies an owner. */
  backgroundSessionId: string | null;
  sessionUsage?: Map<string | null, Usage | null>;
  sessionPlans?: Map<string | null, PlanProgress | null>;
}

/** True when the streaming session is the active (visible) session. */
export function isActiveSessionStreaming(
  host: MessageStoreHost,
  ownerSessionId = host.backgroundSessionId,
): boolean {
  return ownerSessionId === host.activeSessionId;
}

/** Apply a pure transform to whichever session is currently streaming. */
export function mapStreamingMessage(
  host: MessageStoreHost,
  fn: (m: DisplayMessage) => DisplayMessage,
  ownerSessionId = host.backgroundSessionId,
): void {
  if (isActiveSessionStreaming(host, ownerSessionId)) {
    host.messages = host.messages.map(fn);
    return;
  }
  if (!ownerSessionId) return;
  const cached = host.sessionMessages.get(ownerSessionId);
  if (cached) host.sessionMessages.set(ownerSessionId, cached.map(fn));
}

/** Find the streaming assistant message in whichever session owns it. */
export function findStreamingMessage(
  host: MessageStoreHost,
  assistantMsgId: string,
  ownerSessionId = host.backgroundSessionId,
): DisplayMessage | undefined {
  if (isActiveSessionStreaming(host, ownerSessionId)) {
    return host.messages.find((m) => m.id === assistantMsgId);
  }
  if (!ownerSessionId) return undefined;
  return host.sessionMessages.get(ownerSessionId)?.find((m) => m.id === assistantMsgId);
}

/** Resolve the user message that owns a streaming assistant turn. */
export function findPrecedingUserMessageId(
  host: MessageStoreHost,
  assistantMsgId: string,
  ownerSessionId = host.backgroundSessionId,
): string | undefined {
  const messages = isActiveSessionStreaming(host, ownerSessionId)
    ? host.messages
    : ownerSessionId
      ? host.sessionMessages.get(ownerSessionId) ?? []
      : [];
  const assistantIndex = messages.findIndex((message) => message.id === assistantMsgId);
  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'user') return messages[index].id;
  }
  return undefined;
}

/** Finalize streaming display state for exactly one addressed session. */
export function finalizeStreamingMessages(
  host: MessageStoreHost,
  ownerSessionId: string | null,
): void {
  if (ownerSessionId === host.activeSessionId) {
    host.messages = finalizeMessageList(host.messages, ownerSessionId ?? 'local');
    return;
  }
  if (!ownerSessionId) return;
  const cached = host.sessionMessages.get(ownerSessionId);
  if (cached) {
    host.sessionMessages.set(
      ownerSessionId,
      finalizeMessageList(cached, ownerSessionId),
    );
  }
}

function finalizeMessageList(messages: DisplayMessage[], sessionId: string): DisplayMessage[] {
  const at = Date.now();
  return finalizeStalePendingApprovals(messages).map((message) => {
    if (!message.isStreaming) return message;
    return { ...interruptMessageTimeline(message, sessionId, at), isStreaming: false };
  });
}

/**
 * Abort teardown: finalize streaming messages, clear the background session
 * pointer, and idle the status. Returns the background session id that was
 * streaming (so the caller can fire onBackgroundStreamEnd if it differs from
 * the active session).
 */
export function abortStreaming(
  host: MessageStoreHost,
  ownerSessionId: string | null,
): string | null {
  finalizeStreamingMessages(host, ownerSessionId);
  return ownerSessionId && ownerSessionId !== host.activeSessionId ? ownerSessionId : null;
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
  return forceMessagesForSessionSave(host, host.activeSessionId);
}

export function forceMessagesForSessionSave(
  host: MessageStoreHost,
  sessionId: string | null,
): DisplayMessage[] {
  const source = sessionId && sessionId !== host.activeSessionId
    ? host.sessionMessages.get(sessionId) ?? []
    : host.messages;
  const messages = source.filter((m) => m.role !== 'system');
  return finalizeStalePendingApprovals(messages).map((m) => ({ ...m, isStreaming: false }));
}

export function appendSessionMessage(
  host: MessageStoreHost,
  sessionId: string | null,
  message: DisplayMessage,
): void {
  if (sessionId === host.activeSessionId) {
    host.messages = [...host.messages, message];
  } else if (sessionId) {
    const cached = host.sessionMessages.get(sessionId) ?? [];
    host.sessionMessages.set(sessionId, [...cached, message]);
  }
}
