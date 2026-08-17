import {
  canonicalSessionId,
  type ToolApprovalDecision,
  type ToolApprovalRequest,
  type ToolApprovalSettlement,
} from '@svton/agent-core';
import type { DisplayToolCall } from '../types';
import { sanitizeApprovalArguments, sanitizeApprovalMetadata } from '../timeline/approval-public-record';

const SETTLED_KEY_LIMIT = 512;

interface PendingApprovalEntry {
  request: ToolApprovalRequest;
  settle: (decision: ToolApprovalDecision) => boolean;
}

interface LegacyPendingApproval {
  sessionId?: string;
  call: { id: string; name?: string; arguments?: Record<string, unknown> };
  metadata?: Record<string, unknown>;
  resolve: (approved: boolean) => void;
}

/** In-memory live approval requests, isolated by canonical runtime session. */
export class ApprovalQueue {
  private readonly bySession = new Map<string, PendingApprovalEntry[]>();
  private readonly settled = new Set<string>();

  constructor(
    private readonly notify: (sessionId: string) => void = () => {},
    private readonly onBindingRejected: (request: ToolApprovalRequest) => void = () => {},
  ) {}

  get size(): number {
    let size = 0;
    for (const queue of this.bySession.values()) size += queue.length;
    return size;
  }

  enqueue(
    request: ToolApprovalRequest,
    settle: (decision: ToolApprovalDecision) => boolean,
  ): boolean {
    const key = requestKey(request.sessionId, request.requestId);
    const queue = this.bySession.get(request.sessionId) ?? [];
    if (this.settled.has(key) || queue.some((entry) => entry.request.requestId === request.requestId)) {
      return false;
    }
    const next = [...queue, { request, settle }].sort(compareEntries);
    this.bySession.set(request.sessionId, next);
    this.notify(request.sessionId);
    return true;
  }

  head(sessionId: string | null): ToolApprovalRequest | null {
    return this.bySession.get(canonicalSessionId(sessionId))?.[0]?.request ?? null;
  }

  hasSession(sessionId: string | null): boolean {
    return this.head(sessionId) !== null;
  }

  requests(): ToolApprovalRequest[] {
    return [...this.bySession.values()].flatMap((queue) => queue.map(({ request }) => request));
  }

  /** Backward-compatible test/integration adapter; runtime events use enqueue(). */
  set(callId: string, entry: LegacyPendingApproval): void {
    const sessionId = canonicalSessionId(entry.sessionId);
    this.enqueue({
      requestId: `legacy:${callId}`,
      sessionId,
      itemId: callId,
      createdAt: Date.now(),
      toolName: entry.call.name ?? 'tool',
      arguments: sanitizeApprovalArguments(entry.call.arguments ?? {}),
      ...(entry.metadata ? { metadata: sanitizeApprovalMetadata(entry.metadata) } : {}),
      decisions: ['accept', 'decline', 'cancel'],
    }, (decision) => {
      entry.resolve(decision === 'accept' || decision === 'acceptForSession');
      return true;
    });
  }

  bump(): void {
    this.notify(canonicalSessionId(null));
  }

  settle(
    sessionId: string | null,
    requestId: string,
    decision: ToolApprovalDecision,
  ): boolean {
    const ownerSessionId = canonicalSessionId(sessionId);
    const queue = this.bySession.get(ownerSessionId) ?? [];
    const index = queue.findIndex((entry) => entry.request.requestId === requestId);
    const entry = queue[index];
    if (!entry || !entry.request.decisions.includes(decision)) return false;
    this.remove(ownerSessionId, index, entry.request.requestId);
    try {
      const accepted = entry.settle(decision);
      if (!accepted) this.onBindingRejected(entry.request);
      return accepted;
    } catch {
      this.onBindingRejected(entry.request);
      return false;
    }
  }

  settleItem(
    sessionId: string | null,
    itemId: string,
    decision: ToolApprovalDecision,
  ): boolean {
    const request = this.bySession.get(canonicalSessionId(sessionId))
      ?.find((entry) => entry.request.itemId === itemId)?.request;
    return request ? this.settle(request.sessionId, request.requestId, decision) : false;
  }

  observeSettlement(settlement: ToolApprovalSettlement): boolean {
    const queue = this.bySession.get(settlement.sessionId) ?? [];
    const index = queue.findIndex((entry) => entry.request.requestId === settlement.requestId);
    this.remember(requestKey(settlement.sessionId, settlement.requestId));
    if (index < 0) return false;
    this.remove(settlement.sessionId, index, settlement.requestId);
    return true;
  }

  interruptAll(): void {
    if (this.bySession.size === 0) return;
    const sessionIds = [...this.bySession.keys()];
    for (const [sessionId, queue] of this.bySession) {
      for (const { request } of queue) this.remember(requestKey(sessionId, request.requestId));
    }
    this.bySession.clear();
    for (const sessionId of sessionIds) this.notify(sessionId);
  }

  interruptSession(sessionId: string | null): void {
    const ownerSessionId = canonicalSessionId(sessionId);
    const queue = this.bySession.get(ownerSessionId);
    if (!queue?.length) return;
    for (const { request } of queue) {
      this.remember(requestKey(ownerSessionId, request.requestId));
    }
    this.bySession.delete(ownerSessionId);
    this.notify(ownerSessionId);
  }

  toDisplay(sessionId: string | null): DisplayToolCall[] {
    return (this.bySession.get(canonicalSessionId(sessionId)) ?? []).map(({ request }) => ({
      id: request.itemId,
      name: request.toolName,
      arguments: request.arguments,
      ...(request.metadata ? { metadata: request.metadata } : {}),
      status: 'pending_approval',
    }));
  }

  private remove(sessionId: string, index: number, requestId: string): void {
    const queue = this.bySession.get(sessionId) ?? [];
    const next = [...queue.slice(0, index), ...queue.slice(index + 1)];
    if (next.length > 0) this.bySession.set(sessionId, next);
    else this.bySession.delete(sessionId);
    this.remember(requestKey(sessionId, requestId));
    this.notify(sessionId);
  }

  private remember(key: string): void {
    if (this.settled.has(key)) this.settled.delete(key);
    this.settled.add(key);
    while (this.settled.size > SETTLED_KEY_LIMIT) {
      const oldest = this.settled.values().next().value as string | undefined;
      if (oldest === undefined) break;
      this.settled.delete(oldest);
    }
  }
}

function requestKey(sessionId: string, requestId: string): string {
  return `${sessionId}\u0000${requestId}`;
}

function compareEntries(left: PendingApprovalEntry, right: PendingApprovalEntry): number {
  return left.request.createdAt - right.request.createdAt
    || left.request.requestId.localeCompare(right.request.requestId);
}
