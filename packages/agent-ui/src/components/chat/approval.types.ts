export type ApprovalDecisionView =
  | 'accept'
  | 'acceptForSession'
  | 'decline'
  | 'cancel';

export interface ApprovalRequestView {
  requestId: string;
  sessionId: string;
  itemId: string;
  createdAt: number;
  toolName: string;
  arguments: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
  decisions: ApprovalDecisionView[];
}
