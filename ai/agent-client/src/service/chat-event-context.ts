import {
  canonicalSessionId,
  type PublicRuntimeEvent,
  type ToolApprovalRequest,
} from '@svton/agent-core';
import { sanitizeApprovalArguments, sanitizeApprovalMetadata } from '../timeline/approval-public-record';
import {
  findPrecedingUserMessageId,
  findStreamingMessage,
  type MessageStoreHost,
} from './chat-message-store';
import type { ChatRunAddress } from './chat-run.types';

interface LegacyApprovalEvent {
  type: 'tool_approval_needed';
  call?: { id: string; name?: string; arguments?: Record<string, unknown> };
  metadata?: Record<string, unknown>;
}

/** Keeps older client-side event injectors compatible with the canonical request contract. */
export function normalizeApprovalEvent(
  event: PublicRuntimeEvent,
  store: MessageStoreHost,
  address?: ChatRunAddress,
): PublicRuntimeEvent {
  if (event.type !== 'tool_approval_needed' || event.request) return event;
  const legacy = event as unknown as LegacyApprovalEvent;
  if (!legacy.call) return event;
  const sessionId = canonicalSessionId(
    address?.sessionId ?? store.backgroundSessionId ?? store.activeSessionId,
  );
  const request: ToolApprovalRequest = {
    requestId: `legacy:${legacy.call.id}`,
    sessionId,
    itemId: legacy.call.id,
    createdAt: Date.now(),
    toolName: legacy.call.name ?? 'tool',
    arguments: sanitizeApprovalArguments(legacy.call.arguments ?? {}),
    ...(legacy.metadata ? { metadata: sanitizeApprovalMetadata(legacy.metadata) } : {}),
    decisions: ['accept', 'decline', 'cancel'],
  };
  return { type: 'tool_approval_needed', request };
}

export function selectEventTimelineContext(
  store: MessageStoreHost,
  turnId: string,
  address?: ChatRunAddress,
) {
  return {
    sessionId: canonicalSessionId(
      address?.sessionId ?? store.backgroundSessionId ?? store.activeSessionId,
    ),
    turnId,
    retryMessageId: findPrecedingUserMessageId(store, turnId, address?.sessionId),
  };
}

export function hasProjectedLiveApproval(
  store: MessageStoreHost,
  turnId: string,
  request: ToolApprovalRequest,
  address?: ChatRunAddress,
): boolean {
  const owner = findStreamingMessage(store, turnId, address?.sessionId);
  return owner?.timeline?.status === 'running'
    && owner.timeline.items.some((item) => item.kind === 'approvalDecision'
      && item.requestId === request.requestId
      && item.status === 'awaitingApproval');
}

export function decisionEventSessionId(event: PublicRuntimeEvent): string | null {
  if (event.type === 'tool_approval_needed') {
    return (event as { request?: ToolApprovalRequest }).request?.sessionId ?? null;
  }
  if (event.type === 'tool_approval_settled') return event.settlement.sessionId;
  if (event.type === 'user_input_requested') return event.request.sessionId;
  if (event.type === 'user_input_settled') return event.sessionId;
  return null;
}

export function eventBelongsToRun(
  address: ChatRunAddress | undefined,
  sessionId: string,
): boolean {
  return !address || canonicalSessionId(address.sessionId) === sessionId;
}
