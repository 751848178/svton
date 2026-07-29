import type { SvtonAgentRuntime } from '@svton/agent-core';
import type { DisplayMessage } from '../types';
import type { MessageEditPlan } from './chat-commands';

export function captureRuntimeMessageIndex(runtime: SvtonAgentRuntime): number {
  return runtime.getCanonicalMessages().length;
}

export function attachRuntimeMessageIndexes(
  messages: DisplayMessage[],
  runtime: SvtonAgentRuntime,
): DisplayMessage[] {
  const positions = userPositions(runtime.getCanonicalMessages());
  let userOrdinal = 0;
  return messages.map((message) => {
    if (message.role !== 'user') return message;
    const runtimeMessageIndex = positions[userOrdinal];
    userOrdinal += 1;
    return runtimeMessageIndex === undefined
      ? message
      : { ...message, runtimeMessageIndex };
  });
}

export function rollbackRuntimeForMessage(
  runtime: SvtonAgentRuntime,
  currentMessages: DisplayMessage[],
  plan: MessageEditPlan,
): DisplayMessage[] | null {
  const canonical = runtime.getCanonicalMessages();
  let index = plan.runtimeMessageIndex;
  if (index === undefined || canonical[index]?.role !== 'user') {
    index = resolveByUserOrdinal(canonical, currentMessages, plan.targetMessageId);
  }
  if (index === undefined || canonical[index]?.role !== 'user') return null;
  runtime.rollbackCanonicalMessages(index);
  return plan.messages.map((message) => (
    message.id === plan.targetMessageId
      ? { ...message, runtimeMessageIndex: index }
      : message
  ));
}

function resolveByUserOrdinal(
  canonical: ReturnType<SvtonAgentRuntime['getCanonicalMessages']>,
  messages: DisplayMessage[],
  targetMessageId: string,
): number | undefined {
  const targetIndex = messages.findIndex((message) => message.id === targetMessageId);
  if (targetIndex < 0 || messages[targetIndex].role !== 'user') return undefined;
  const ordinal = messages.slice(0, targetIndex + 1)
    .filter((message) => message.role === 'user').length - 1;
  return userPositions(canonical)[ordinal];
}

function userPositions(messages: ReadonlyArray<{ role: string }>): number[] {
  return messages
    .map((message, index) => message.role === 'user' ? index : -1)
    .filter((index) => index >= 0);
}
