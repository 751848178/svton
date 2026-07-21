import type { ToolCall } from '../tool/types';

export type PendingApprovalMap = Map<string, {
  call: ToolCall;
  resolve: (approved: boolean) => void;
  timestamp: number;
}>;

export function waitForToolApproval(
  pendingApprovals: PendingApprovalMap,
  call: ToolCall,
  signal?: AbortSignal,
): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (approved: boolean) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      pendingApprovals.delete(call.id);
      resolve(approved);
    };
    const abort = () => finish(false);

    pendingApprovals.set(call.id, {
      call,
      resolve: finish,
      timestamp: Date.now(),
    });
    signal?.addEventListener('abort', abort, { once: true });
  });
}
