import type { SvtonCapabilityEvent } from './types';
import type { ToolCall, ToolResult } from '../tool/types';
import { waitForToolApproval, type PendingApprovalMap } from './tool-approval-wait.utils';

const USER_REJECTED_OUTPUT = 'Tool call rejected by user';
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
  signal?: AbortSignal,
  decorateResult?: ToolResultDecorator,
  metadata?: Record<string, unknown>,
): AsyncGenerator<SvtonCapabilityEvent, ToolResult | null> {
  const approval = waitForToolApproval(pendingApprovals, call, signal);
  if (!signal?.aborted) {
    yield metadata
      ? { type: 'tool_approval_needed', call, metadata }
      : { type: 'tool_approval_needed', call };
  }

  const approved = await approval;
  if (approved) return null;
  const errorResult = createErrorResult(call.id, signal?.aborted ? RUN_ABORTED_OUTPUT : USER_REJECTED_OUTPUT);
  const result = decorateResult ? decorateResult(errorResult) : errorResult;
  return result;
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
