/**
 * 密钥中心域类型
 *
 * 单一职责：仅声明接口。
 */

export interface SecretKey {
  id: string;
  name: string;
  type: string;
  description?: string;
  projectId?: string | null;
  environmentId?: string | null;
  createdAt: string;
}

/** 密钥类型图标名（与 key-type-icons 的 ICON_PATHS 一一对应）。 */
export type KeyTypeIconName = 'shield' | 'key' | 'ticket' | 'lock' | 'database' | 'cog';

export interface KeyTypeOption {
  value: string;
  labelKey: string;
  icon: KeyTypeIconName;
}

/** 密钥作用域过滤（GET /keys?projectId=&environmentId=）。 */
export interface KeyScopeFilter {
  projectId?: string;
  environmentId?: string;
}

export interface KeyInput {
  name: string;
  type: string;
  value: string;
  description: string;
  projectId?: string;
  environmentId?: string;
}

export interface GenerateKeyInput {
  type: string;
  length: number;
}
