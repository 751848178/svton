import type { ManagedResource, ResourceActionDefinition } from './types';

export function listActionsForResource(
  actions: ResourceActionDefinition[],
  resource: ManagedResource,
) {
  return actions.filter((action) => (
    action.providers.includes(resource.provider) &&
    action.kinds.includes(resource.kind) &&
    action.sourceTypes.includes(resource.sourceType)
  ));
}

export function buildResourceActionKey(resourceId: string, actionKey: string) {
  return `${resourceId}:${actionKey}`;
}

export function formatActionRisk(risk: ResourceActionDefinition['risk']) {
  if (risk === 'high') return '高风险';
  if (risk === 'medium') return '中风险';
  return '低风险';
}
