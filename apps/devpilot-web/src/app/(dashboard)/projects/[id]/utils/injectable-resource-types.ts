/**
 * 可部署注入资源类型（前端常量镜像）
 *
 * 单一职责：声明「resourceType.key 存在 envTemplate、部署时会被注入」的类型集合，
 * 用于在资源绑定卡片里把「会注入的 resource_instance」与「仅归类」的资源明确区分。
 *
 * 镜像来源：apps/devpilot-api/src/resource-request/resource-type-defaults.constants.ts
 * （mysql/postgresql/redis/server/domain 五类有 envTemplate）。
 *
 * 后端 resolveDeploymentEnvVars 只对 envTemplate 非空的 resourceType 生成 KEY=value，
 * 故此集合之外的 resource_instance 绑定到环境后不会产生部署变量。
 */

/** 拥有 envTemplate、绑定到环境后会被部署注入的 ResourceType.key 集合。 */
export const INJECTABLE_RESOURCE_TYPE_KEYS: ReadonlySet<string> = new Set([
  'mysql',
  'postgresql',
  'redis',
  'server',
  'domain',
]);

/** 给定 ResourceType.key，判断绑定后是否会被部署注入。 */
export function isResourceTypeInjectable(typeKey: string | null | undefined): boolean {
  return Boolean(typeKey && INJECTABLE_RESOURCE_TYPE_KEYS.has(typeKey));
}
