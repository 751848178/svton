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

/** 风险等级 -> i18n key（resourceControl.risk.*），调用处用 t 解析。 */
export function actionRiskLabelKey(risk: ResourceActionDefinition['risk']): string {
  return `risk.${risk}`;
}

/**
 * 解析操作运行记录里原始 action key -> 人类可读名称。
 *
 * 优先匹配当前已加载的 ResourceActionDefinition.name；未命中则回退原始 key。
 * （action key 来自后端动态列表，前端不维护固定枚举，故通过运行时数据解析。）
 */
export function resolveActionName(
  actionKey: string,
  actions: ResourceActionDefinition[],
): string {
  return actions.find((action) => action.key === actionKey)?.name ?? actionKey;
}
