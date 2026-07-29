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

/**
 * Retry: drop the trailing assistant message (if any) and re-run from the last
 * user message. Returns the new messages + the prompt to re-run, or null.
 */
export function planRetry(messages: DisplayMessage[]): { messages: DisplayMessage[]; prompt: string } | null {
  if (messages.length === 0) return null;
  const lastIdx = messages.length - 1;
  const truncated = messages[lastIdx].role === 'assistant' ? messages.slice(0, lastIdx) : messages;
  const lastUser = [...truncated].reverse().find((m) => m.role === 'user');
  if (!lastUser) return null;
  return { messages: truncated, prompt: lastUser.content };
}

/**
 * Retry from a specific user message: truncate everything after it. Returns
 * the new messages + prompt, or null if the id is missing/not a user message.
 */
export function planRetryFromMessage(
  messages: DisplayMessage[],
  messageId: string,
): { messages: DisplayMessage[]; prompt: string } | null {
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx === -1 || messages[idx].role !== 'user') return null;
  const userMsg = messages[idx];
  return { messages: messages.slice(0, idx + 1), prompt: userMsg.content };
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
): { messages: DisplayMessage[]; prompt: string } | null {
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx === -1 || messages[idx].role !== 'user') return null;
  return {
    messages: [...messages.slice(0, idx), { ...messages[idx], content: newContent }],
    prompt: newContent,
  };
}
