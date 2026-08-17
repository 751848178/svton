import type { SvtonCapabilityEvent } from './types';
import type { ToolCall, ToolResult } from '../tool/types';
import type { PermissionManager } from '../permission/manager';
import { createToolApprovalRequest } from './tool-approval-request.utils';
import { waitForToolApproval, type PendingApprovalMap } from './tool-approval-wait.utils';
import type { ToolApprovalSettlement } from './tool-approval.types';

const USER_REJECTED_OUTPUT = 'Tool call rejected by user';
const USER_CANCELED_OUTPUT = 'Tool call canceled by user';
const RUN_ABORTED_OUTPUT = 'Tool call canceled because run was aborted';
type ToolResultDecorator = (result: ToolResult) => ToolResult;

export function createPermissionDeniedResult(
  callId: string,
  reason?: string,
): ToolResult {
  return createErrorResult(callId, `Permission denied: ${reason || 'not allowed'}`);
}

export async function* requestUserApproval(
  pendingApprovals: PendingApprovalMap,
  call: ToolCall,
  options: {
    sessionId?: string;
    signal?: AbortSignal;
    decorateResult?: ToolResultDecorator;
    metadata?: Record<string, unknown>;
    reason?: string;
    sessionScopeKey?: string;
    permissionManager?: PermissionManager | null;
  } = {},
): AsyncGenerator<SvtonCapabilityEvent, ToolResult | null> {
  const request = createToolApprovalRequest({
    call,
    sessionId: options.sessionId,
    createdAt: Date.now(),
    metadata: options.metadata,
    reason: options.reason,
    sessionScopeKey: options.sessionScopeKey,
  });
  const approval = waitForToolApproval(pendingApprovals, call, request, options.signal);
  if (!options.signal?.aborted) {
    yield { type: 'tool_approval_needed', request };
  }

  const requestedDecision = await approval;
  const decision = requestedDecision === 'acceptForSession'
    && !options.permissionManager?.grantForSession(request.sessionId, request.sessionScopeKey)
    ? 'accept'
    : requestedDecision;
  const settlement: ToolApprovalSettlement = {
    requestId: request.requestId,
    sessionId: request.sessionId,
    itemId: request.itemId,
    decision,
    settledAt: Date.now(),
  };
  yield { type: 'tool_approval_settled', settlement };
  if (decision === 'acceptForSession' || decision === 'accept') return null;
  const output = decision === 'interrupted'
    ? RUN_ABORTED_OUTPUT
    : decision === 'cancel'
      ? USER_CANCELED_OUTPUT
      : USER_REJECTED_OUTPUT;
  const errorResult = withApprovalMetadata(createErrorResult(call.id, output), settlement);
  return options.decorateResult ? options.decorateResult(errorResult) : errorResult;
}

export function readRunAbortResult(
  call: ToolCall,
  signal?: AbortSignal,
): ToolResult | null {
  if (!signal?.aborted) return null;
  return createErrorResult(call.id, RUN_ABORTED_OUTPUT);
}

function createErrorResult(callId: string, output: string): ToolResult {
  return { callId, output, isError: true };
}

function withApprovalMetadata(
  result: ToolResult,
  settlement: ToolApprovalSettlement,
): ToolResult {
  if (settlement.decision === 'accept' || settlement.decision === 'acceptForSession') return result;
  return {
    ...result,
    metadata: {
      ...result.metadata,
      approval: {
        requestId: settlement.requestId,
        sessionId: settlement.sessionId,
        itemId: settlement.itemId,
        decision: settlement.decision,
      },
    },
  };
}
