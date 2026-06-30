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
  projectId?: string;
  createdAt: string;
}

export interface KeyTypeOption {
  value: string;
  label: string;
  icon: string;
}

export interface KeyInput {
  name: string;
  type: string;
  value: string;
  description: string;
}

export interface GenerateKeyInput {
  type: string;
  length: number;
}
