import type { ToolResult } from '@svton/agent-core';
import type { DisplayMessage, PlanProgress } from '../types';
import { updateToolCallStatusInMessages } from './chat-message-tool-status.utils';
import {
  isActiveSessionStreaming,
  mapStreamingMessage,
  type MessageStoreHost,
} from './chat-message-store';

/** Updates a tool call only within its addressed session. */
export function updateAddressedToolCallStatus(
  host: MessageStoreHost,
  callId: string,
  status: DisplayMessage['toolCalls'] extends (infer T)[] | undefined
    ? (T extends { status: infer S } ? S : never)
    : never,
  metadata?: Record<string, unknown>,
  ownerSessionId = host.activeSessionId,
): void {
  if (ownerSessionId === host.activeSessionId) {
    host.messages = updateToolCallStatusInMessages(host.messages, callId, status, metadata);
    return;
  }
  if (!ownerSessionId) return;
  const messages = host.sessionMessages.get(ownerSessionId);
  if (messages) host.sessionMessages.set(
    ownerSessionId,
    updateToolCallStatusInMessages(messages, callId, status, metadata),
  );
}

/** Projects plan progress into the exact owner message and selected adapter. */
export function applyPlanProgressToStore(
  host: MessageStoreHost,
  result: ToolResult,
  assistantMsgId: string,
  ownerSessionId = host.backgroundSessionId,
): void {
  if (result.isError || !result.metadata) return;
  const progress = result.metadata.planProgress as PlanProgress | undefined;
  if (!progress?.planId || !Array.isArray(progress.steps)) return;
  const plan = { planId: progress.planId, title: progress.title, steps: progress.steps };
  host.sessionPlans?.set(ownerSessionId, plan);
  if (isActiveSessionStreaming(host, ownerSessionId)) host.activePlan = plan;
  mapStreamingMessage(host, (message) => {
    if (message.id !== assistantMsgId) return message;
    const blocks = [...(message.blocks ?? [])];
    const index = blocks.findIndex((block) =>
      block.type === 'plan' && block.plan?.planId === progress.planId);
    const block = { type: 'plan' as const, plan };
    if (index >= 0) blocks[index] = block;
    else blocks.push(block);
    return { ...message, blocks };
  }, ownerSessionId);
}
