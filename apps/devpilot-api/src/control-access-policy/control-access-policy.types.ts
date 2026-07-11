import type { Prisma } from "@prisma/client";
import type { MemberRole } from "../team/dto/team.dto";

export type DefaultMinimumRole = "member" | "admin";

export type ControlAccessCheckInput = {
  teamId: string;
  actorId?: string | null;
  projectId?: string | null;
  environmentId?: string | null;
  category: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  risk?: string | null;
  phase:
    | "approval_request"
    | "approval_review"
    | "approved_execution"
    | "control_write"
    | "control_read"
    | "sensitive_read";
};

export type PolicyRecord = {
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
};

export type PolicyMembership = {
  role: MemberRole;
  userId: string;
};

export type PolicyAuditRecord = {
  id: string;
  teamId: string;
  projectId: string | null;
  environmentId: string | null;
  name: string;
  effect: string;
  principalType: string;
  principalRole: string | null;
  principalUserId: string | null;
};
