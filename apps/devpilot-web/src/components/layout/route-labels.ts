/**
 * (dashboard) 路由段 → messages/zh.json `nav` 段 labelKey 的映射。
 *
 * 只收录静态路由段;动态段(/projects/[id]、/teams/[id] 等)不在此表,
 * 由面包屑组件按「短 ID」策略降级展示。
 * 文案复用 nav 段已有 key,不另起一套。
 */
export const ROUTE_SEGMENT_LABEL_KEYS: Record<string, string> = {
  // 项目
  projects: 'projects',
  new: 'new',
  import: 'import',
  applications: 'applications',
  // 基础设施
  servers: 'servers',
  'resource-control': 'resourceControl',
  backups: 'backups',
  monitoring: 'monitoring',
  logs: 'logs',
  'execution-governance': 'executionGovernance',
  'execution-policies': 'executionPolicies',
  sites: 'sites',
  'proxy-configs': 'proxyConfigs',
  'cdn-configs': 'cdnConfigs',
  domain: 'domain',
  cdn: 'cdn',
  // 资源
  resources: 'resources',
  'resource-requests': 'resourceRequests',
  'resource-instances': 'resourceInstances',
  keys: 'keys',
  // 配置
  presets: 'presets',
  git: 'git',
  'audit-events': 'auditEvents',
  'operation-approvals': 'operationApprovals',
  'access-policies': 'accessPolicies',
  // 团队 / 管理
  teams: 'teams',
  admin: 'admin',
  'resource-pools': 'resourcePools',
  'resource-types': 'resourceTypes',
};

/** 判断路由段是否为已知静态段(反之则按动态段处理)。 */
export function isStaticRouteSegment(segment: string): boolean {
  return segment in ROUTE_SEGMENT_LABEL_KEYS;
}
