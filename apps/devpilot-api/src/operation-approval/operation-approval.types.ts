import type { Prisma } from "@prisma/client";

export type CreateOperationApprovalInput = {
  teamId: string;
  requesterId?: string | null;
  projectId?: string | null;
  environmentId?: string | null;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  serverId?: string | null;
  siteId?: string | null;
  managedResourceId?: string | null;
  category: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  risk: string;
  summary?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | Prisma.InputJsonValue | null;
  reusePending?: boolean;
};

export type OperationApprovalRequirementPolicyRecord = {
  id: string;
  name: string;
  effect: string;
  principalType: string;
  principalRole: string | null;
  principalUserId: string | null;
  projectId: string | null;
  environmentId: string | null;
  categories: Prisma.JsonValue | null;
  actions: Prisma.JsonValue | null;
  riskLevels: Prisma.JsonValue | null;
  priority: number;
};

export type OperationApprovalRequirement = {
  required: boolean;
  source: "control_access_policy";
  reason: string;
  resourceType: string;
  operationType: string;
  category: string;
  risk: string;
  projectId: string | null;
  environmentId: string | null;
  requesterRole: string | null;
  ownerBypass: boolean;
  defaultReviewerRole: "admin";
  additionalReviewerRoles: string[];
  reviewerUserIds: string[];
  matchedPolicies: Array<{
    id: string;
    name: string;
    effect: string;
    principalType: string;
    principalRole: string | null;
    principalUserId: string | null;
    projectId: string | null;
    environmentId: string | null;
    priority: number;
  }>;
};

export type ValidateOperationApprovalInput = CreateOperationApprovalInput & {
  approvalId?: string | null;
};

export type OperationApprovalMatchRecord = {
  category: string;
  action: string;
  targetType: string;
  targetId: string | null;
  projectId: string | null;
  environmentId: string | null;
  applicationId: string | null;
  applicationServiceId: string | null;
  serverId: string | null;
  siteId: string | null;
  managedResourceId: string | null;
};

export type OperationApprovalAuditRecord = OperationApprovalMatchRecord & {
  id: string;
  teamId: string;
  requesterId: string | null;
  reviewerId: string | null;
  risk: string;
  status: string;
  summary: string | null;
  reviewComment: string | null;
};
