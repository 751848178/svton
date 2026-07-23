/** 资源管控域常量 - 字段键（标签走 i18n，在调用处用 resolveKindLabel/resolveProviderLabel 解析）。 */

/**
 * next-intl 的 t 函数接口（仅用到的子集）。
 * `has` 用于在未知后端枚举值时安全回退，避免抛 missing-key 错误。
 */
export interface LabelTFunc {
  (key: string): string;
  has: (key: string) => boolean;
}

/** 受管资源类型 key（值即后端枚举；标签存在 resourceControl.kind.* 下）。 */
export const KIND_KEYS = [
  'docker_container',
  'mysql',
  'redis',
  'database',
  'log_service',
  'object_storage',
] as const;

/** 资源 Provider key（值即后端枚举；标签存在 resourceControl.provider.* 下）。 */
export const PROVIDER_KEYS = [
  'docker',
  'aliyun-rds',
  'aliyun-sls',
  'tencent-cos',
  'all',
] as const;

/** 解析资源类型标签：命中 i18n 则返回翻译，否则回退原始 key。 */
export function resolveKindLabel(kind: string, t: LabelTFunc): string {
  const key = `kind.${kind}`;
  return t.has(key) ? t(key) : kind;
}

/** 解析 Provider 标签：命中 i18n 则返回翻译，否则回退原始 key。 */
export function resolveProviderLabel(provider: string, t: LabelTFunc): string {
  const key = `provider.${provider}`;
  return t.has(key) ? t(key) : provider;
}
