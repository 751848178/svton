/**
 * Approval queue — the in-memory map of tool calls awaiting a user decision.
 *
 * Populated by the `tool_approval_needed` event (event handler) and drained by
 * `approveToolCall`/`rejectToolCall` (ChatService public API). Each entry holds
 * the resolve callback of the runtime's approval promise plus any auto-review
 * metadata surfaced to the UI.
 *
 * Mutations bump a change-version and invoke an optional `onBump` callback so
 * the owning ChatService can sync its observable `pendingApprovalVersion` (the
 * surface React hooks subscribe to).
 */

import type { ToolCall } from '@svton/agent-core';
import type { DisplayToolCall } from '../types';

export interface PendingApproval {
  call: ToolCall;
  metadata?: Record<string, unknown>;
  resolve: (approved: boolean) => void;
}

export class ApprovalQueue {
  private map = new Map<string, PendingApproval>();
  private readonly onBump: () => void;

  constructor(onBump: () => void = () => {}) {
    this.onBump = onBump;
  }

  get size(): number { return this.map.size; }
  has(callId: string): boolean { return this.map.has(callId); }
  get(callId: string): PendingApproval | undefined { return this.map.get(callId); }

  set(callId: string, entry: PendingApproval): void {
    this.map.set(callId, entry);
    this.bump();
  }

  /** Bump the change-version + notify the owner's observable. */
  bump(): void {
    this.onBump();
  }

  delete(callId: string): void {
    if (this.map.delete(callId)) this.bump();
  }

  clear(): void {
    if (this.map.size === 0) return;
    this.map.clear();
    this.bump();
  }

  keys(): IterableIterator<string> { return this.map.keys(); }

  /**
   * Resolve a pending approval: remove it and invoke its resolve callback.
   * Returns true if the call was pending (and thus resolved).
   */
  resolve(callId: string, approved: boolean): boolean {
    const pending = this.map.get(callId);
    if (!pending) return false;
    pending.resolve(approved);
    this.map.delete(callId);
    this.bump();
    return true;
  }

  /** Snapshot for the UI's `getPendingToolCalls()`. */
  toDisplay(): DisplayToolCall[] {
    return Array.from(this.map.values()).map(({ call, metadata }) => ({
      id: call.id,
      name: call.name,
      arguments: call.arguments ?? {},
      ...(metadata ? { metadata } : {}),
      status: 'pending_approval',
    }));
  }
}
