/**
 * 资源类型域工具函数
 *
 * 单一职责：字段编辑态归一化、Schema 构建、选项解析、表单初始化（纯函数）。
 */

import {
  resourceFieldTypes,
  type ResourceFieldType,
  type ResourceField,
  type ResourceFieldOption,
  type ResourceSchema,
  type ResourceType,
  type ResourceTypeFormData,
  type EditableResourceField,
} from './types';

export function isResourceFieldType(value: unknown): value is ResourceFieldType {
  return typeof value === 'string' && resourceFieldTypes.includes(value as ResourceFieldType);
}

export function getSchemaFields(schema?: ResourceSchema): ResourceField[] {
  const fields = schema?.fields;
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((field) => Boolean(field?.key && field?.label))
    .map((field) => ({ ...field, type: isResourceFieldType(field.type) ? field.type : 'text' }));
}

export function getSchemaFieldCount(schema?: ResourceSchema): number {
  return getSchemaFields(schema).length;
}

/** 生成可编辑字段的稳定 id（用于 React key，与字段内容解耦）。 */
let editableFieldSeq = 0;
function nextEditableFieldId(): string {
  editableFieldSeq += 1;
  return `ef-${editableFieldSeq}`;
}

export function createEmptyEditableField(): EditableResourceField {
  return {
    id: nextEditableFieldId(),
    key: '',
    label: '',
    type: 'text',
    required: false,
    sensitive: false,
    placeholder: '',
    defaultValue: '',
    optionsText: '',
  };
}

export function normalizeEditableField(field: EditableResourceField): EditableResourceField {
  if (field.type === 'checkbox' && field.defaultValue !== 'true')
    return { ...field, defaultValue: '' };
  if (field.type !== 'select' && field.optionsText) return { ...field, optionsText: '' };
  return field;
}

export function toEditableFields(schema?: ResourceSchema): EditableResourceField[] {
  return getSchemaFields(schema).map((field) => ({
    id: nextEditableFieldId(),
    key: field.key,
    label: field.label,
    type: field.type,
    required: Boolean(field.required),
    sensitive: Boolean(field.sensitive),
    placeholder: field.placeholder || '',
    defaultValue:
      field.default === undefined || field.default === null ? '' : String(field.default),
    optionsText: formatOptionsText(field.options),
  }));
}

export function getInitialResourceTypeForm(
  resourceType: ResourceType | null,
): ResourceTypeFormData {
  return {
    key: resourceType?.key || '',
    name: resourceType?.name || '',
    category: resourceType?.category || 'infrastructure',
    description: resourceType?.description || '',
    approvalMode: resourceType?.approvalMode || 'manual',
    provisioningMode: resourceType?.provisioningMode || 'manual',
    envTemplate: resourceType?.envTemplate || '',
  };
}

export function buildPreviewSchema(fields: EditableResourceField[]): ResourceSchema {
  try {
    return buildResourceSchema(fields, 'Schema');
  } catch {
    return { fields: [] };
  }
}

export function buildResourceSchema(
  fields: EditableResourceField[],
  schemaName: string,
): ResourceSchema {
  const normalizedFields: ResourceField[] = [];
  const fieldKeys = new Set<string>();
  fields.forEach((field, index) => {
    if (!hasFieldInput(field)) return;
    const fieldLabel = field.label.trim();
    const fieldKey = field.key.trim();
    if (!fieldKey || !fieldLabel)
      throw new Error(`${schemaName}第 ${index + 1} 个字段缺少 Key 或名称`);
    if (fieldKeys.has(fieldKey)) throw new Error(`${schemaName}字段 Key 重复：${fieldKey}`);
    fieldKeys.add(fieldKey);
    const normalizedField: ResourceField = { key: fieldKey, label: fieldLabel, type: field.type };
    if (field.required) normalizedField.required = true;
    if (field.sensitive) normalizedField.sensitive = true;
    if (field.placeholder.trim()) normalizedField.placeholder = field.placeholder.trim();
    if (field.defaultValue.trim()) {
      normalizedField.default = parseDefaultValue(
        field.defaultValue,
        field.type,
        `${schemaName}字段 ${fieldLabel}`,
      );
    }
    if (field.type === 'select') {
      const options = parseOptions(field.optionsText);
      if (options.length === 0) throw new Error(`${schemaName}字段 ${fieldLabel} 至少需要一个选项`);
      normalizedField.options = options;
    }
    normalizedFields.push(normalizedField);
  });
  return { fields: normalizedFields };
}

function hasFieldInput(field: EditableResourceField): boolean {
  return Boolean(
    field.key.trim() ||
    field.label.trim() ||
    field.placeholder.trim() ||
    field.defaultValue.trim() ||
    field.optionsText.trim() ||
    field.required ||
    field.sensitive,
  );
}

function parseDefaultValue(
  value: string,
  type: ResourceFieldType,
  label: string,
): string | number | boolean {
  const trimmedValue = value.trim();
  if (type === 'checkbox') {
    if (['true', '1', 'yes'].includes(trimmedValue.toLowerCase())) return true;
    if (['false', '0', 'no'].includes(trimmedValue.toLowerCase())) return false;
    throw new Error(`${label} 的默认值需要是 true 或 false`);
  }
  if (type === 'number') {
    const numberValue = Number(trimmedValue);
    if (!Number.isFinite(numberValue)) throw new Error(`${label} 的默认值需要是数字`);
    return numberValue;
  }
  return trimmedValue;
}

function parseOptions(optionsText: string): ResourceFieldOption[] {
  const optionValues = new Set<string>();
  return optionsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf('=');
      const rawLabel = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim() : line;
      const rawValue = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : line;
      const value = rawValue || rawLabel;
      const label = rawLabel || value;
      if (optionValues.has(value)) throw new Error(`选项值重复：${value}`);
      optionValues.add(value);
      return { label, value };
    });
}

function formatOptionsText(options?: ResourceFieldOption[]): string {
  if (!Array.isArray(options)) return '';
  return options
    .map((option) => {
      if (!option?.value) return '';
      return option.label && option.label !== option.value
        ? `${option.value}=${option.label}`
        : option.value;
    })
    .filter(Boolean)
    .join('\n');
}
