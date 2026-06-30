/**
 * 操作审批域类型
 *
 * 单一职责：仅声明接口。
 */

export interface ApprovalActor {
  id: string;
  name?: string | null;
  email: string;
}

export interface OperationApproval {
  id: string;
  requesterId?: string | null;
  reviewerId?: string | null;
  projectId?: string | null;
  environmentId?: string | null;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  serverId?: string | null;
  siteId?: string | null;
  managedResourceId?: string | null;
  category: 'resource_action' | 'service_operation' | 'deployment' | 'site_sync' | string;
  action: string;
  targetType: string;
  targetId?: string | null;
  risk: 'low' | 'medium' | 'high' | string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | string;
  summary?: string | null;
  reason?: string | null;
  reviewComment?: string | null;
  metadata?: Record<string, unknown> | null;
  requestedAt: string;
  reviewedAt?: string | null;
  consumedAt?: string | null;
  requester?: ApprovalActor | null;
  reviewer?: ApprovalActor | null;
  project?: { id: string; name: string } | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  application?: { id: string; name: string; status: string } | null;
  applicationService?: { id: string; name: string; kind: string; runtime?: string | null } | null;
  server?: { id: string; name: string; host: string } | null;
  site?: { id: string; name: string; primaryDomain: string } | null;
  managedResource?: {
    id: string;
    name: string;
    sourceType: string;
    provider: string;
    kind: string;
    endpoint?: string | null;
  } | null;
}

export type ApprovalDecision = 'approved' | 'rejected';

export interface ApprovalStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  highRisk: number;
}
