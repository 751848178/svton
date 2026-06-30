/**
 * 资源凭证域类型
 *
 * 单一职责：仅声明接口。
 */

export interface Resource {
  id: string;
  type: string;
  name: string;
  createdAt: string;
}

export interface ResourceField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  default?: string | number;
}

export interface ResourceType {
  id: string;
  name: string;
  description?: string;
  fields: ResourceField[];
}

export interface ResourceInput {
  type: string;
  name: string;
  config: Record<string, string>;
}
