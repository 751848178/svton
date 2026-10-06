export const ENVIRONMENT_CONFIG_REVISION_SELECT = {
  id: true,
  revision: true,
  snapshotHash: true,
  plainVariables: true,
  secretReferences: true,
  resourceReferences: true,
  routeSnapshot: true,
  policyReferences: true,
  displayName: true,
  displayDescription: true,
  observabilitySnapshot: true,
  changeSummary: true,
  source: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

export const ENVIRONMENT_CONFIG_REVISION_AUDIT_SELECT = {
  id: true,
  action: true,
  targetType: true,
  targetId: true,
  risk: true,
  status: true,
  summary: true,
  occurredAt: true,
  actor: { select: { id: true, name: true, email: true } },
} as const;
