import type { Prisma } from "@prisma/client";

export const CONTROL_ACCESS_POLICY_INCLUDE = {
  createdBy: { select: { id: true, name: true, email: true } },
  principalUser: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true } },
  environment: { select: { id: true, key: true, name: true, status: true } },
} satisfies Prisma.ControlAccessPolicyInclude;

export const CONTROL_ACCESS_POLICY_MATCH_SELECT = {
  id: true,
  name: true,
  effect: true,
  principalType: true,
  principalRole: true,
  principalUserId: true,
  projectId: true,
  environmentId: true,
  categories: true,
  actions: true,
  riskLevels: true,
} satisfies Prisma.ControlAccessPolicySelect;
