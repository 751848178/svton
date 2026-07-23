/**
 * 资源池域常量
 *
 * 单一职责：仅放类型选项（值 + i18n 标签 key + 图标名）。
 * 标签在 admin.poolType.* 下解析；图标渲染见 pool-type-icons。
 */

import type { PoolTypeIconName } from './types';

export interface PoolTypeOption {
  value: string;
  labelKey: string;
  icon: PoolTypeIconName;
}

export const POOL_TYPES: PoolTypeOption[] = [
  { value: 'mysql', labelKey: 'poolType.mysql', icon: 'database' },
  { value: 'redis', labelKey: 'poolType.redis', icon: 'database' },
  { value: 'nginx', labelKey: 'poolType.nginx', icon: 'server' },
  { value: 'cdn', labelKey: 'poolType.cdn', icon: 'globe' },
];

/** 默认图标（未知类型回退）。 */
export const DEFAULT_POOL_ICON: PoolTypeIconName = 'cloud';

/** 按类型值查选项，未匹配回退默认图标。 */
export function getPoolTypeInfo(type: string): PoolTypeOption {
  return (
    POOL_TYPES.find((option) => option.value === type) || {
      value: type,
      labelKey: '',
      icon: DEFAULT_POOL_ICON,
    }
  );
}

/** next-intl t 的子集（用 has 安全回退）。 */
export interface PoolLabelTFunc {
  (key: string): string;
  has: (key: string) => boolean;
}

/** 解析资源池类型标签：命中 i18n 则翻译，否则回退原始值大写。 */
export function resolvePoolTypeLabel(type: string, t: PoolLabelTFunc): string {
  const key = `poolType.${type}`;
  return t.has(key) ? t(key) : type.toUpperCase();
}
