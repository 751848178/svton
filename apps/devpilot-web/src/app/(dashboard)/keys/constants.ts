/**
 * 密钥中心常量
 *
 * 单一职责：仅放密钥类型选项。
 */

import type { KeyTypeOption } from './types';

export const KEY_TYPES: KeyTypeOption[] = [
  { value: 'jwt_secret', label: 'JWT Secret', icon: '🔐' },
  { value: 'encryption_key', label: '加密密钥', icon: '🔑' },
  { value: 'api_key', label: 'API Key', icon: '🎫' },
  { value: 'oauth_secret', label: 'OAuth Secret', icon: '🔒' },
  { value: 'database_password', label: '数据库密码', icon: '💾' },
  { value: 'custom', label: '自定义', icon: '⚙️' },
];

/** 按类型值查类型信息，未匹配回退默认。 */
export function getKeyTypeInfo(type: string): KeyTypeOption {
  return KEY_TYPES.find((t) => t.value === type) || { value: type, label: type, icon: '🔑' };
}
