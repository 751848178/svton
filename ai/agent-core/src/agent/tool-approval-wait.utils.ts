import type { ToolCall } from '../tool/types';
import type { PendingApprovalMap } from './approval-gate';
import type {
  PendingApproval,
  ToolApprovalRequest,
  ToolApprovalSettlementDecision,
} from './tool-approval.types';

export type { PendingApprovalMap } from './approval-gate';

export function waitForToolApproval(
  pendingApprovals: PendingApprovalMap,
  call: ToolCall,
  request: ToolApprovalRequest,
  signal?: AbortSignal,
): Promise<ToolApprovalSettlementDecision> {
  if (signal?.aborted) return Promise.resolve('interrupted');

  return new Promise<ToolApprovalSettlementDecision>((resolve) => {
    let settled = false;
    const finish: PendingApproval['resolve'] = (resolution) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      pendingApprovals.delete(request.requestId);
      resolve(resolution === true ? 'accept' : resolution === false ? 'decline' : resolution);
    };
    const abort = () => finish('interrupted');

    pendingApprovals.set(request.requestId, {
      call,
      request,
      resolve: finish,
      timestamp: request.createdAt,
    });
    signal?.addEventListener('abort', abort, { once: true });
  });
}
