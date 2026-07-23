/**
 * 执行治理域 - 标签化工具（无状态纯函数）
 *
 * 单一职责：把机器可读的 operationKey / adapterKey / blocker 等
 * 原始枚举与拼接串，归一化为人类可读文案。
 *
 * - operationKey 形如 `deployment.run` / `resource.sync_docker_inventory` /
 *   `backup.<provider>.<kind>`，部分为模板生成，无法穷举 -> 走「已知前缀映射 +
 *   兜底 humanize（按 . 与 _ 切词、首字母大写）」。
 * - adapterKey / transport / queueMode 为枚举，走小映射 + 原值兜底。
 * - blocker 串（`severity · count`）由组件层用 i18n 拼装，这里只提供枚举翻译键。
 *
 * 所有函数对未知值安全兜底，绝不抛错。
 *
 * TODO(i18n): 下方 operationKeyLabels / operationDomainLabels /
 * humanizeEnumValue 内的标签为硬编码简体中文，未走 next-intl。当前应用以 zh-CN 为主
 * 且 en locale 暂不可达（request.ts 强制 zh），故这些标签对实际用户是正确的。
 * 待启用 en locale 时，需将本文件的已知值映射改造为 i18n 键并在各调用点通过 t() 解析
 * （humanizers 被多个组件调用，直接改签名回归风险较高，应作为独立改造项处理）。
 * 此为有意的架构取舍：优先保证 5b-1/5b-2 正确性修复，理论 locale 的重构延后。
 */

/** 已知的 operationKey 前缀/精确值 -> 中文标签。 */
const operationKeyLabels: Record<string, string> = {
  'deployment.run': '部署 · 执行',
  'deployment.rollback': '部署 · 回滚',
  'deployment.smoke_check': '部署 · 冒烟测试',
  site_sync: '站点同步',
  'resource.sync_docker_inventory': '资源 · 同步 Docker 清单',
  'resource.connection.probe': '资源 · 连接探测',
  'resource.query.readonly': '资源 · 只读查询',
};

/** operationKey 已知域前缀（点号前）-> 中文域标签。 */
const operationDomainLabels: Record<string, string> = {
  deployment: '部署',
  backup: '备份',
  restore: '恢复',
  resource: '资源',
};

/**
 * 把 operationKey 转为人类可读文案。
 * 命中精确映射用映射；否则若命中已知域前缀，返回「域 · 动作」；最后兜底 humanize。
 */
export function humanizeOperationKey(operationKey: string): string {
  if (!operationKey) return '-';
  if (operationKeyLabels[operationKey]) return operationKeyLabels[operationKey];
  const dotIndex = operationKey.indexOf('.');
  if (dotIndex > 0) {
    const domain = operationKey.slice(0, dotIndex);
    const action = operationKey.slice(dotIndex + 1);
    if (operationDomainLabels[domain]) {
      return `${operationDomainLabels[domain]} · ${humanizeSnake(action)}`;
    }
  }
  return humanizeSnake(operationKey);
}

/** adapterKey / 模板化 key（`backup.<provider>.<kind>`）兜底 humanize。 */
export function humanizeAdapterKey(adapterKey: string): string {
  if (!adapterKey) return '-';
  return humanizeSnake(adapterKey.replace(/-/g, '_'));
}

/** transport / queueMode 等短枚举：原值兜底，仅对个别常见值翻译。 */
export function humanizeEnumValue(value: string): string {
  if (!value) return '-';
  const labels: Record<string, string> = {
    server_agent: 'Server Agent',
    direct: '直连',
    remote: '远端',
    strict: '严格',
    loose: '宽松',
    buffered: '缓冲',
  };
  return labels[value] || humanizeSnake(value);
}

/**
 * 人类可读短标识：`#<shortId>`，用于 UUID / lockOwner 等长 ID 的降级展示。
 * 保留原值在 title 中以便复制。
 */
export function mutedShortId(id: string): string {
  if (!id) return '-';
  return `#${id.length > 8 ? id.slice(0, 8) : id}`;
}

/** snake_case / dotted 片段 -> 首字母大写、空格分隔的短语。 */
function humanizeSnake(value: string): string {
  return value
    .split(/[_\-.]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
