/**
 * Chat commands — pure helpers for the message-editing public API
 * (retry / retryFromMessage / editMessage).
 *
 * Extracted from ChatService (PI007) so the service class stays a thin
 * composition root. Each helper returns the new messages array (or null when
 * the precondition fails); the caller owns the `@action()` mutation + the
 * subsequent `runAssistant` call.
 */

import type { DisplayMessage } from '../types';

export interface MessageEditPlan {
  messages: DisplayMessage[];
  prompt: string;
  targetMessageId: string;
  runtimeMessageIndex?: number;
  images?: DisplayMessage['images'];
}

/**
 * Retry: drop the trailing assistant message (if any) and re-run from the last
 * user message. Returns the new messages + the prompt to re-run, or null.
 */
export function planRetry(messages: DisplayMessage[]): MessageEditPlan | null {
  if (messages.length === 0) return null;
  const index = findLastUserIndex(messages);
  return index < 0 ? null : planFromUser(messages, index, messages[index]);
}

/**
 * Retry from a specific user message: truncate everything after it. Returns
 * the new messages + prompt, or null if the id is missing/not a user message.
 */
export function planRetryFromMessage(
  messages: DisplayMessage[],
  messageId: string,
): MessageEditPlan | null {
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx === -1 || messages[idx].role !== 'user') return null;
  return planFromUser(messages, idx, messages[idx]);
}

/**
 * Edit a user message in place and truncate everything after it. Returns the
 * new messages + the edited prompt, or null if the id is missing/not a user
 * message.
 */
export function planEditMessage(
  messages: DisplayMessage[],
  messageId: string,
  newContent: string,
): MessageEditPlan | null {
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx === -1 || messages[idx].role !== 'user') return null;
  const edited = { ...messages[idx], content: newContent };
  return planFromUser(messages, idx, edited);
}

function planFromUser(
  messages: DisplayMessage[],
  index: number,
  user: DisplayMessage,
): MessageEditPlan {
  return {
    messages: [...messages.slice(0, index), user],
    prompt: user.content,
    targetMessageId: user.id,
    runtimeMessageIndex: user.runtimeMessageIndex,
    images: user.images,
  };
}

function findLastUserIndex(messages: DisplayMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'user') return index;
  }
  return -1;
}
