export type NavIconName =
  | 'home'
  | 'folder-plus'
  | 'folder-git'
  | 'boxes'
  | 'server'
  | 'gauge'
  | 'archive'
  | 'activity'
  | 'scroll-text'
  | 'list-checks'
  | 'shield-check'
  | 'globe'
  | 'network'
  | 'zap'
  | 'key-round'
  | 'file-plus'
  | 'database'
  | 'lock'
  | 'bookmark'
  | 'git-branch'
  | 'file-search'
  | 'check-square'
  | 'shield-alert'
  | 'users'
  | 'layers'
  | 'tags'
  | 'at-sign'
  | 'cloud';

export interface NavigationItem {
  href: string;
  labelKey: string;
  icon: NavIconName;
  /** 次要项:默认收纳到分组「更多」浮层,仅当活跃或搜索时直接展开。Phase 1 默认不标,Phase 2 按业务逐项标记。 */
  secondary?: boolean;
}

export interface NavigationSection {
  titleKey: string;
  items: NavigationItem[];
}

/**
 * 单条导航项的活跃判定(供 sidebar 与 header 共用)。
 *
 * 规则:pathname === href,或 pathname 位于 href 的子路径下。
 * 用 `href + '/'` 拼接判断,天然免疫兄弟前缀误中:
 * '/cdn-configs/...' 不会命中 '/cdn','/resource-requests' 与 '/resources' 互不误中。
 */
export function isNavItemActive(pathname: string, item: NavigationItem): boolean {
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

/**
 * 在一组导航项中取「最长命中」的那一项。
 * 同分区多项同时前缀命中时(如 '/projects/new' 与 '/projects'),
 * 只高亮 href 最长的最具体项;无命中返回 null。
 */
export function findActiveNavItem(
  pathname: string,
  items: NavigationItem[],
): NavigationItem | null {
  let best: NavigationItem | null = null;
  for (const item of items) {
    if (isNavItemActive(pathname, item) && (best === null || item.href.length > best.href.length)) {
      best = item;
    }
  }
  return best;
}

/**
 * Header 主导航只保留主 CTA(新建项目)。
 * 其余页面入口统一由 Sidebar / 移动端菜单的 navigationSections 提供,
 * 避免同一页面在 Header 与 Sidebar 出现两个名字。
 */
export const primaryHeaderLinks: NavigationItem[] = [
  { href: '/projects/new', labelKey: 'createProject', icon: 'folder-plus' },
];

export const navigationSections: NavigationSection[] = [
  {
    // 独立首区:全局仪表盘入口,复用 nav.dashboard 既有文案(zh.json 已含该 key)
    titleKey: 'dashboard',
    items: [{ href: '/dashboard', labelKey: 'dashboard', icon: 'home' }],
  },
  {
    titleKey: 'sectionProjects',
    items: [
      { href: '/projects/new', labelKey: 'createProject', icon: 'folder-plus' },
      { href: '/projects', labelKey: 'myProjects', icon: 'folder-git' },
      { href: '/applications', labelKey: 'applications', icon: 'boxes' },
    ],
  },
  {
    titleKey: 'sectionInfrastructure',
    items: [
      { href: '/servers', labelKey: 'servers', icon: 'server' },
      { href: '/sites', labelKey: 'sites', icon: 'globe' },
      { href: '/proxy-configs', labelKey: 'proxyConfigs', icon: 'network' },
      { href: '/cdn-configs', labelKey: 'cdnConfigs', icon: 'zap' },
      { href: '/domain', labelKey: 'domainConfigGenerator', icon: 'at-sign', secondary: true },
      { href: '/cdn', labelKey: 'cdnConfigGenerator', icon: 'cloud', secondary: true },
    ],
  },
  {
    titleKey: 'sectionResources',
    items: [
      { href: '/resource-control', labelKey: 'resourceControl', icon: 'gauge' },
      { href: '/resources', labelKey: 'resourceCredentials', icon: 'key-round' },
      { href: '/resource-requests', labelKey: 'resourceRequests', icon: 'file-plus' },
      { href: '/resource-instances', labelKey: 'resourceInstances', icon: 'database' },
      { href: '/keys', labelKey: 'keys', icon: 'lock' },
    ],
  },
  {
    titleKey: 'sectionOperations',
    items: [
      { href: '/backups', labelKey: 'backups', icon: 'archive' },
      { href: '/monitoring', labelKey: 'monitoring', icon: 'activity' },
      { href: '/logs', labelKey: 'logs', icon: 'scroll-text' },
      { href: '/execution-governance', labelKey: 'executionGovernance', icon: 'list-checks' },
      { href: '/execution-policies', labelKey: 'executionPolicies', icon: 'shield-check' },
    ],
  },
  {
    titleKey: 'sectionGovernance',
    items: [
      { href: '/operation-approvals', labelKey: 'operationApprovals', icon: 'check-square' },
      { href: '/audit-events', labelKey: 'auditEvents', icon: 'file-search' },
      { href: '/access-policies', labelKey: 'accessPolicies', icon: 'shield-alert' },
    ],
  },
  {
    titleKey: 'sectionConfig',
    items: [
      { href: '/presets', labelKey: 'presets', icon: 'bookmark', secondary: true },
      { href: '/git', labelKey: 'git', icon: 'git-branch', secondary: true },
      { href: '/teams', labelKey: 'teamManagement', icon: 'users' },
      { href: '/admin/resource-pools', labelKey: 'resourcePools', icon: 'layers', secondary: true },
      { href: '/admin/resource-types', labelKey: 'resourceTypes', icon: 'tags', secondary: true },
    ],
  },
];

/** 仅 admin 角色可见的导航项前缀。 */
const ADMIN_ONLY_PREFIX = '/admin/';

/**
 * 按当前用户角色过滤导航分区(渲染层门控,navigationSections 保持静态常量):
 * 非 admin 用户看不到 '/admin/' 前缀的导航项;过滤后为空的分区整体移除。
 */
export function filterNavSectionsByRole(
  sections: NavigationSection[],
  userRole: string | null | undefined,
): NavigationSection[] {
  if (userRole === 'admin') {
    return sections;
  }
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.href.startsWith(ADMIN_ONLY_PREFIX)),
    }))
    .filter((section) => section.items.length > 0);
}
