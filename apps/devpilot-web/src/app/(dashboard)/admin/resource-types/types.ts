/**
 * 资源类型域类型
 *
 * 单一职责：仅声明接口、字段类型与常量。
 */

export const resourceFieldTypes = [
  'text',
  'number',
  'password',
  'textarea',
  'select',
  'checkbox',
] as const;
export type ResourceFieldType = (typeof resourceFieldTypes)[number];

export interface ResourceFieldOption {
  label: string;
  value: string;
}

export interface ResourceField {
  key: string;
  label: string;
  type: ResourceFieldType;
  required?: boolean;
  default?: string | number | boolean;
  placeholder?: string;
  options?: ResourceFieldOption[];
  sensitive?: boolean;
}

export interface ResourceSchema {
  fields?: ResourceField[];
}

export interface ResourceType {
  id: string;
  key: string;
  name: string;
  description?: string;
  category?: string;
  enabled: boolean;
  approvalMode: string;
  provisioningMode: string;
  requestSchema?: ResourceSchema;
  deliverySchema?: ResourceSchema;
  envTemplate?: string;
  createdAt: string;
}

export interface ResourceTypeFormData {
  key: string;
  name: string;
  category: string;
  description: string;
  approvalMode: string;
  provisioningMode: string;
  envTemplate: string;
}

export interface EditableResourceField {
  key: string;
  label: string;
  type: ResourceFieldType;
  required: boolean;
  sensitive: boolean;
  placeholder: string;
  defaultValue: string;
  optionsText: string;
}

export const fieldTypeLabels: Record<ResourceFieldType, string> = {
  text: '文本',
  number: '数字',
  password: '密码',
  textarea: '多行文本',
  select: '下拉选择',
  checkbox: '开关',
};
