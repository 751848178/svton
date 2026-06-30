/** 资源申请域工具 - Schema 字段读取、初始值构建、payload/spec 构建、JSON 解析。 */

import type {
  ResourceRequestSchema,
  ResourceType,
  ResourceField,
  ResourceFieldValue,
} from './types';

export function getSchemaFields(schema?: ResourceRequestSchema): ResourceField[] {
  const fields = schema?.fields;
  return Array.isArray(fields) ? fields.filter((field) => Boolean(field?.key && field?.label)) : [];
}

export function getResourceFields(resourceType?: ResourceType): ResourceField[] {
  return getSchemaFields(resourceType?.requestSchema);
}

export function getFieldDefaultValue(field: ResourceField): ResourceFieldValue {
  if (field.type === 'checkbox') {
    return Boolean(field.default);
  }
  if (field.default === undefined || field.default === null) {
    return '';
  }
  return String(field.default);
}

export function buildInitialValuesFromFields(
  fields: ResourceField[],
): Record<string, ResourceFieldValue> {
  return fields.reduce<Record<string, ResourceFieldValue>>((acc, field) => {
    acc[field.key] = getFieldDefaultValue(field);
    return acc;
  }, {});
}

export function buildInitialFieldValues(
  resourceType?: ResourceType,
): Record<string, ResourceFieldValue> {
  return buildInitialValuesFromFields(getResourceFields(resourceType));
}

export function buildPayloadFromFields(
  fields: ResourceField[],
  values: Record<string, ResourceFieldValue>,
  includeField: (field: ResourceField) => boolean = () => true,
): Record<string, unknown> {
  return fields.reduce<Record<string, unknown>>((acc, field) => {
    if (!includeField(field)) {
      return acc;
    }

    const value = values[field.key];

    if (field.type === 'checkbox') {
      acc[field.key] = Boolean(value);
      return acc;
    }

    if (value === '' || value === undefined) {
      return acc;
    }

    if (field.type === 'number') {
      const numericValue = Number(value);
      acc[field.key] = Number.isFinite(numericValue) ? numericValue : value;
      return acc;
    }

    acc[field.key] = value;
    return acc;
  }, {});
}

export function buildSpecFromFields(
  fields: ResourceField[],
  values: Record<string, ResourceFieldValue>,
): Record<string, unknown> {
  return buildPayloadFromFields(fields, values);
}

export function parseJsonObject(value: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(value || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} 必须是 JSON 对象`);
  }
  return parsed as Record<string, unknown>;
}
