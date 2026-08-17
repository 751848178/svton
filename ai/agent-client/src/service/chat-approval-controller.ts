import {
  canonicalSessionId,
  type ToolApprovalDecision,
  type ToolApprovalRequest,
} from '@svton/agent-core';
import type { MessageStoreHost } from './chat-message-store';
import { ApprovalQueue } from './chat-approval-queue';
import { interruptApprovalProjection, updateApprovalToolStatus } from './chat-approval-projection';
import type { ChatRunAddress } from './chat-run.types';

interface ApprovalRuntime {
  settleToolApproval(
    sessionId: string,
    requestId: string,
    decision: ToolApprovalDecision,
  ): boolean;
  approveToolCall?(itemId: string): void;
  rejectToolCall?(itemId: string): void;
}

/** Coordinates the live queue, its exact runtime binding, and visible-session status. */
export class ChatApprovalController {
  readonly queue = new ApprovalQueue(
    (sessionId) => this.onQueueChanged(sessionId),
    (request) => interruptApprovalProjection(this.host, request),
  );

  constructor(
    private readonly host: MessageStoreHost,
    private readonly getRuntime: (sessionId: string | null) => ApprovalRuntime | null,
    private readonly notifyVersion: () => void,
  ) {}

  captureSettlement(request: ToolApprovalRequest, address?: ChatRunAddress) {
    const runtime = this.getRuntime(address?.sessionId ?? this.host.activeSessionId);
    return (decision: ToolApprovalDecision) =>
      runtime?.settleToolApproval(request.sessionId, request.requestId, decision) ?? false;
  }

  settleRequest(requestId: string, decision: ToolApprovalDecision): boolean {
    const request = this.queue.head(this.host.activeSessionId);
    if (!request || request.requestId !== requestId) return false;
    const accepted = this.queue.settle(request.sessionId, requestId, decision);
    if (accepted) updateApprovalToolStatus(
      this.host,
      request.sessionId,
      request.itemId,
      decision === 'accept' || decision === 'acceptForSession' ? 'running' : 'error',
    );
    return accepted;
  }

  settleItem(itemId: string, decision: ToolApprovalDecision): boolean {
    const request = this.queue.head(this.host.activeSessionId);
    if (request?.itemId === itemId) return this.settleRequest(request.requestId, decision);
    const runtime = this.getRuntime(this.host.activeSessionId);
    if (decision === 'accept') runtime?.approveToolCall?.(itemId);
    if (decision === 'decline') runtime?.rejectToolCall?.(itemId);
    return false;
  }

  interruptAll(): void {
    for (const request of this.queue.requests()) interruptApprovalProjection(this.host, request);
    this.queue.interruptAll();
  }

  interruptSession(sessionId: string | null): void {
    const ownerSessionId = canonicalSessionId(sessionId);
    for (const request of this.queue.requests()) {
      if (request.sessionId === ownerSessionId) interruptApprovalProjection(this.host, request);
    }
    this.queue.interruptSession(sessionId);
  }

  private onQueueChanged(_sessionId: string): void {
    this.notifyVersion();
  }
}
