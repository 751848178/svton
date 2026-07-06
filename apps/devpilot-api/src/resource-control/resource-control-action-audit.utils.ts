/**
 * Pure resource-action approval-context + audit builders.
 *
 * Extracted verbatim from `ResourceControlService` private methods so the
 * actions service stays under the 200-line ceiling. Stateless data shaping.
 * No behavior change.
 */

type ActionResource = {
  id: string; name: string; projectId: string | null; environmentId: string | null;
  serverId: string | null; sourceType: string; provider: string; kind: string; endpoint: string | null;
};

export function buildResourceApprovalContext(
  teamId: string, userId: string, resource: ActionResource,
  action: { key: string; risk: string; mode: string }, reason?: string,
) {
  return {
    teamId, requesterId: userId, projectId: resource.projectId, environmentId: resource.environmentId,
    serverId: resource.serverId, managedResourceId: resource.id,
    category: 'resource_action', action: `resource.${action.key}`,
    targetType: 'managed_resource', targetId: resource.id, risk: action.risk,
    summary: `申请执行资源动作 ${action.key}`,
    reason: reason || '申请执行非 dry-run 资源动作',
    metadata: {
      resourceName: resource.name, sourceType: resource.sourceType, provider: resource.provider,
      kind: resource.kind, endpoint: resource.endpoint, mode: action.mode,
    },
  };
}

export function buildResourceActionAuditInput(
  teamId: string, userId: string | null, resource: ActionResource,
  action: { key: string; risk: string },
  actionRun: {
    id: string; status: string; dryRun: boolean; executorKey: string; adapterKey: string;
    operationApprovalId?: string | null; error: string | null;
  },
) {
  return {
    teamId, actorId: userId, projectId: resource.projectId, environmentId: resource.environmentId,
    serverId: resource.serverId, managedResourceId: resource.id, resourceActionRunId: actionRun.id,
    operationApprovalId: actionRun.operationApprovalId,
    category: 'resource_action', action: `resource.${action.key}`,
    targetType: 'managed_resource', targetId: resource.id, risk: action.risk,
    status: actionRun.status, summary: `资源动作 ${action.key} ${actionRun.status}`,
    metadata: {
      dryRun: actionRun.dryRun, sourceType: resource.sourceType, provider: resource.provider,
      kind: resource.kind, endpoint: resource.endpoint, resourceName: resource.name,
      executorKey: actionRun.executorKey, adapterKey: actionRun.adapterKey,
      operationApprovalId: actionRun.operationApprovalId, error: actionRun.error,
    },
  };
}
