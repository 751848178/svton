import type { ToolCall } from '../tool/types';

export type ToolApprovalDecision =
  | 'accept'
  | 'acceptForSession'
  | 'decline'
  | 'cancel';

export type ToolApprovalSettlementDecision = ToolApprovalDecision | 'interrupted';

export interface ToolApprovalRequest {
  requestId: string;
  sessionId: string;
  itemId: string;
  createdAt: number;
  toolName: string;
  arguments: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
  decisions: ToolApprovalDecision[];
  sessionScopeKey?: string;
}

export interface ToolApprovalSettlement {
  requestId: string;
  sessionId: string;
  itemId: string;
  decision: ToolApprovalSettlementDecision;
  settledAt: number;
}

export interface ToolApprovalResultMetadata {
  approval: {
    requestId: string;
    sessionId: string;
    itemId: string;
    decision: Exclude<ToolApprovalSettlementDecision, 'accept' | 'acceptForSession'>;
  };
}

/** Raw call ownership remains private to the core approval gate. */
export interface PendingApproval {
  call: ToolCall;
  /** Present for request-scoped approvals; optional for legacy map consumers. */
  request?: ToolApprovalRequest;
  resolve: (decision: ToolApprovalSettlementDecision | boolean) => void;
  /** @deprecated Use request.createdAt. */
  timestamp?: number;
}
