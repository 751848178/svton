/**
 * ApprovalGate — owns the svton `pendingApprovals` map and the Pi
 * `beforeToolCall` abort hook.
 *
 * Architecture §3/§5.2: Pi Agent owns tool scheduling; svton owns the approval
 * gate. The `tool_approval_needed` event itself is emitted from inside the
 * existing `ToolExecutionService` (which runs the full permission/auto-review
 * pipeline) via the tool-adapter event sink — this module owns the *state*
 * the approval flow resolves against:
 *   - `pendingApprovals: Map<requestId, PendingApproval>` — the promises the
 *     ToolExecutionService awaits.
 *   - `beforeToolCall` — a thin abort gate installed on Pi Agent so an aborted
 *     run short-circuits tool preparation without executing the pipeline.
 *   - `approveToolCall` / `rejectToolCall` / `abortPending` — the public
 *     surface the runtime delegates to.
 */
import type { BeforeToolCallContext, BeforeToolCallResult } from '@earendil-works/pi-agent-core';
import type { PendingApproval } from './types';
import { canonicalSessionId } from './session-id';
import type { ToolApprovalDecision, ToolApprovalSettlementDecision } from './tool-approval.types';

export type PendingApprovalMap = Map<string, PendingApproval>;

/**
 * Owns pending approvals and exposes the resolve/reject surface plus the Pi
 * `beforeToolCall` abort gate.
 */
export class ApprovalGate {
  readonly pendingApprovals: PendingApprovalMap = new Map();

  /** Approve a pending tool call (resolves its await). */
  approveToolCall(callId: string): void {
    this.settleLegacyCall(callId, 'accept');
  }

  /** Reject a pending tool call (resolves its await with false). */
  rejectToolCall(callId: string): void {
    this.settleLegacyCall(callId, 'decline');
  }

  /** Settle exactly one request owned by the named canonical session. */
  settleToolApproval(
    sessionId: string,
    requestId: string,
    decision: ToolApprovalDecision,
  ): boolean {
    const pending = this.pendingApprovals.get(requestId);
    if (!pending?.request) return false;
    if (pending.request.sessionId !== canonicalSessionId(sessionId)) return false;
    if (!pending.request.decisions.includes(decision)) return false;
    return this.finish(requestId, pending, decision);
  }

  /** Reject every pending approval (called on abort). */
  abortPending(sessionId?: string): void {
    const canonical = sessionId === undefined ? undefined : canonicalSessionId(sessionId);
    for (const [key, pending] of [...this.pendingApprovals]) {
      if (canonical !== undefined && pending.request?.sessionId !== canonical) continue;
      this.finish(key, pending, 'interrupted');
    }
  }

  private settleLegacyCall(callId: string, decision: ToolApprovalDecision): boolean {
    for (const [key, pending] of this.pendingApprovals) {
      if (pending.call.id === callId) return this.finish(key, pending, decision);
    }
    return false;
  }

  private finish(
    key: string,
    pending: PendingApproval,
    decision: ToolApprovalSettlementDecision,
  ): boolean {
    if (this.pendingApprovals.get(key) !== pending) return false;
    this.pendingApprovals.delete(key);
    pending.resolve(decision);
    return true;
  }

  /**
   * Build the Pi `beforeToolCall` hook.
   *
   * The full permission/approval pipeline runs inside the AgentTool wrapper
   * (via ToolExecutionService); this hook only enforces the abort gate so a
   * run aborted mid-tool-preparation does not start execution. Returning
   * `{ block: true, reason }` makes Pi emit an error tool result instead.
   */
  toBeforeToolCall() {
    return async (
      ctx: BeforeToolCallContext,
      signal?: AbortSignal,
    ): Promise<BeforeToolCallResult | undefined> => {
      if (signal?.aborted) {
        return { block: true, reason: 'Tool call canceled because run was aborted' };
      }
      // The toolCall id is the canonical svton call id; expose it so the
      // gate can be inspected, but no blocking happens here.
      void ctx;
      return undefined;
    };
  }
}
