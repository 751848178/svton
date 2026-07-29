/**
 * Policy gates for the tool execution pipeline (Architecture §5.3, §7.4).
 *
 * These are the svton-owned security boundaries that run BEFORE a tool is
 * allowed to execute. They are extracted from `ToolExecutionService` so the
 * orchestrator stays under the 200-line ceiling and each gate has a single
 * responsibility. The gates are, in order:
 *
 *   1. permission check — `PermissionManager.check`
 *   2. auto-reviewer (if the call needs approval) — `AutoReviewerManager.review`
 *   3. user approval (if the reviewer escalates or no reviewer is configured)
 *
 * Every gate yields the svton `AgentEvent`s it produces (permission-denied
 * `tool_call_end`, auto-review-deny `tool_call_end`, `tool_approval_needed`)
 * and returns a discriminated outcome the orchestrator switches on. The
 * orchestrator owns the abort/skill/hook gates that surround this block.
 *
 * This module is pure policy resolution — it never touches the platform or
 * executes the tool. Execution stays in `ToolExecutionService`.
 */
import type { PermissionManager } from '../permission/manager';
import type { AutoReviewerManager } from '../auto-reviewer/manager';
import type { ReviewResult } from '../auto-reviewer/types';
import type { ToolCall, ToolResult } from '../tool/types';
import type { AgentEvent } from './types';
import type { ToolExecOptions } from './tool-executor';
import type { PendingApprovalMap } from './approval-gate';
import { logger } from '../utils/logger';
import { toAutoReviewMetadata, withAutoReviewMetadata } from './tool-auto-review-result.utils';
import { createPermissionDeniedResult, requestUserApproval } from './tool-execution-approval.utils';

/** Inputs shared by every gate. */
export interface PolicyGateContext {
  call: ToolCall;
  workingDir: string;
  permissionManager: PermissionManager | null;
  autoReviewer: AutoReviewerManager | null;
  pendingApprovals: PendingApprovalMap;
  execOptions: ToolExecOptions;
}

/** Gate outcome — the orchestrator branches on this. */
export type PolicyGateOutcome =
  | { kind: 'blocked'; result: ToolResult }
  | { kind: 'approved'; autoReviewResult: ReviewResult | null };

/**
 * Resolve the permission → auto-review → user-approval chain.
 *
 * Yields any svton events produced along the way and returns the outcome.
 * `blocked` means a gate denied the call (the yielded `tool_call_end` already
 * carries the denial); `approved` means the tool may execute.
 */
export async function* runPermissionAndApprovalGate(
  ctx: PolicyGateContext,
): AsyncGenerator<AgentEvent, PolicyGateOutcome> {
  if (!ctx.permissionManager) return { kind: 'approved', autoReviewResult: null };

  const decision = ctx.permissionManager.check(ctx.call);
  if (!decision.allowed) {
    const result = createPermissionDeniedResult(ctx.call.id, decision.reason);
    yield { type: 'tool_call_end', result };
    return { kind: 'blocked', result };
  }
  if (!decision.needsApproval) {
    return { kind: 'approved', autoReviewResult: null };
  }

  const outcome = yield* resolveApproval(ctx);
  return outcome;
}

/** Auto-reviewer + user-approval resolution when permission requires approval. */
async function* resolveApproval(
  ctx: PolicyGateContext,
): AsyncGenerator<AgentEvent, PolicyGateOutcome> {
  if (!ctx.autoReviewer) {
    const rejection = yield* requestUserApproval(
      ctx.pendingApprovals, ctx.call, ctx.execOptions.signal,
    );
    return rejection
      ? { kind: 'blocked', result: rejection }
      : { kind: 'approved', autoReviewResult: null };
  }

  const review = await ctx.autoReviewer.review({
    toolCall: ctx.call,
    toolName: ctx.call.name,
    args: ctx.call.arguments,
    workingDir: ctx.workingDir,
  });

  if (review.verdict === 'approve') {
    logger.info('Tool', `Auto-approved by rule: ${review.ruleId ?? 'auto'}`, { tool: ctx.call.name });
    return { kind: 'approved', autoReviewResult: review };
  }

  if (review.verdict === 'deny') {
    const result = withAutoReviewMetadata({
      callId: ctx.call.id,
      output: `Auto-reviewer denied: ${review.reason}`,
      isError: true,
    }, review);
    yield { type: 'tool_call_end', result };
    return { kind: 'blocked', result };
  }

  // ask_user — escalate to user approval, decorating the result with the review.
  const rejection = yield* requestUserApproval(
    ctx.pendingApprovals, ctx.call, ctx.execOptions.signal,
    (result) => withAutoReviewMetadata(result, review),
    toAutoReviewMetadata(review),
  );
  if (rejection) return { kind: 'blocked', result: rejection };
  return { kind: 'approved', autoReviewResult: review };
}
