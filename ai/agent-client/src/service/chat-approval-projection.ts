import { canonicalSessionId, type ToolApprovalRequest } from '@svton/agent-core';
import type { DisplayMessage, DisplayToolCall } from '../types';
import { interruptApprovalInMessages } from '../timeline/message-projection';
import type { MessageStoreHost } from './chat-message-store';
import { updateToolCallStatusInMessages } from './chat-message-tool-status.utils';

/** Apply an approval-only projection to its owning active or cached session. */
export function updateApprovalToolStatus(
  host: MessageStoreHost,
  sessionId: string,
  itemId: string,
  status: DisplayToolCall['status'],
): void {
  updateSessionMessages(host, sessionId, (messages) =>
    updateToolCallStatusInMessages(messages, itemId, status));
}

export function interruptApprovalProjection(
  host: MessageStoreHost,
  request: ToolApprovalRequest,
): void {
  updateSessionMessages(host, request.sessionId, (messages) =>
    interruptApprovalInMessages(messages, request.sessionId, request.requestId));
  updateApprovalToolStatus(host, request.sessionId, request.itemId, 'error');
}

function updateSessionMessages(
  host: MessageStoreHost,
  sessionId: string,
  update: (messages: DisplayMessage[]) => DisplayMessage[],
): void {
  if (canonicalSessionId(host.activeSessionId) === sessionId) {
    host.messages = update(host.messages);
    return;
  }
  const cached = host.sessionMessages.get(sessionId);
  if (cached) host.sessionMessages.set(sessionId, update(cached));
}
