/**
 * 密钥中心常量
 *
 * 单一职责：仅放密钥类型选项（值 + i18n 标签 key + 图标名）。
 * 标签在 keys.typeLabel.* 下解析；图标渲染见 key-type-icons。
 */

import type { KeyTypeIconName, KeyTypeOption } from './types';

export const KEY_TYPES: KeyTypeOption[] = [
  { value: 'jwt_secret', labelKey: 'typeLabel.jwt_secret', icon: 'shield' },
  { value: 'encryption_key', labelKey: 'typeLabel.encryption_key', icon: 'key' },
  { value: 'api_key', labelKey: 'typeLabel.api_key', icon: 'ticket' },
  { value: 'oauth_secret', labelKey: 'typeLabel.oauth_secret', icon: 'lock' },
  { value: 'database_password', labelKey: 'typeLabel.database_password', icon: 'database' },
  { value: 'custom', labelKey: 'typeLabel.custom', icon: 'cog' },
];

/** 默认图标（未知类型回退）。 */
export const DEFAULT_KEY_ICON: KeyTypeIconName = 'key';

/** 按类型值查类型信息，未匹配回退 custom 图标 + 原始值的标签 key。 */
export function getKeyTypeInfo(type: string): KeyTypeOption {
  return (
    KEY_TYPES.find((t) => t.value === type) || {
      value: type,
      labelKey: 'typeLabel.custom',
      icon: DEFAULT_KEY_ICON,
    }
  );
}
