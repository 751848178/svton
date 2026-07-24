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
  | 'cloud'
  | 'book-open';

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
    // createProject 由 Header 主导航(primaryHeaderLinks)承载,避免与 sidebar 同名重复
    titleKey: 'sectionProjects',
    items: [
      { href: '/projects', labelKey: 'myProjects', icon: 'folder-git' },
      { href: '/applications', labelKey: 'applications', icon: 'boxes' },
    ],
  },
  {
    // 基础设施区:servers/sites + CDN 配置台账。
    // 已下线的重叠模块(后端表/服务全保留,零迁移风险,仅从用户入口移除):
    //   - proxy-configs:与站点重叠且 sync 是假实现,站点才是真正生效的反向代理;
    //   - domain(Nginx 生成器)与 cdn(CDN 生成器):无状态下载工具,与 sites/cdn-configs 台账
    //     是"生成器 vs 管理列表"的同型重复,已降级为对应台账页内的导出入口/废弃提示。
    titleKey: 'sectionInfrastructure',
    items: [
      { href: '/servers', labelKey: 'servers', icon: 'server' },
      { href: '/sites', labelKey: 'sites', icon: 'globe' },
      { href: '/cdn-configs', labelKey: 'cdnConfigs', icon: 'zap' },
    ],
  },
  {
    // 资源区:纳管视图(管控)在前,生命周期 申请→实例 居中,连接库与密钥中心在尾。
    // 「资源凭证」实为预置的连接配置库(代码生成时消费),更名为「资源连接」更贴合用途。
    titleKey: 'sectionResources',
    items: [
      { href: '/resource-control', labelKey: 'resourceControl', icon: 'gauge' },
      { href: '/resource-requests', labelKey: 'resourceRequests', icon: 'file-plus' },
      { href: '/resource-instances', labelKey: 'resourceInstances', icon: 'database' },
      { href: '/resources', labelKey: 'resourceConnections', icon: 'key-round' },
      { href: '/keys', labelKey: 'keys', icon: 'lock' },
    ],
  },
  {
    // 运维区:日常可观测/备份,与治理区分离。
    titleKey: 'sectionOperations',
    items: [
      { href: '/monitoring', labelKey: 'monitoring', icon: 'activity' },
      { href: '/logs', labelKey: 'logs', icon: 'scroll-text' },
      { href: '/backups', labelKey: 'backups', icon: 'archive' },
    ],
  },
  {
    // 治理区:按治理生命周期 Define→Gate→Runtime→Observe 聚合,
    // 此前散落在 sectionOperations(execution-*)与 sectionGovernance,合并为单分区避免来回寻找。
    titleKey: 'sectionGovernance',
    items: [
      { href: '/execution-policies', labelKey: 'executionPolicies', icon: 'shield-check' },
      { href: '/access-policies', labelKey: 'accessPolicies', icon: 'shield-alert' },
      { href: '/operation-approvals', labelKey: 'operationApprovals', icon: 'check-square' },
      { href: '/execution-governance', labelKey: 'executionGovernance', icon: 'list-checks' },
      { href: '/audit-events', labelKey: 'auditEvents', icon: 'file-search' },
    ],
  },
  {
    // 配置区只保留通用配置项(presets/git),团队与管理拆分为独立分区。
    // 该分组只有 2 项,直接全部展开,无需收纳到「更多」。
    titleKey: 'sectionConfig',
    items: [
      { href: '/presets', labelKey: 'presets', icon: 'bookmark' },
      { href: '/git', labelKey: 'git', icon: 'git-branch' },
    ],
  },
  {
    // 团队区:使用既有 sectionTeam 文案键(此前定义但未用)
    titleKey: 'sectionTeam',
    items: [{ href: '/teams', labelKey: 'teamManagement', icon: 'users' }],
  },
  {
    // 管理区:使用既有 sectionAdmin 文案键(此前定义但未用),仅 admin 可见
    titleKey: 'sectionAdmin',
    items: [
      { href: '/admin/resource-pools', labelKey: 'resourcePools', icon: 'layers' },
      { href: '/admin/resource-types', labelKey: 'resourceTypes', icon: 'tags' },
    ],
  },
  {
    // 文档区:平台级文档中心,所有用户可见。
    titleKey: 'sectionHelp',
    items: [{ href: '/docs', labelKey: 'platformDocs', icon: 'book-open' }],
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
