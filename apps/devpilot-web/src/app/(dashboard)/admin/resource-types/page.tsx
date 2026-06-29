'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const resourceFieldTypes = ['text', 'number', 'password', 'textarea', 'select', 'checkbox'] as const;

type ResourceFieldType = (typeof resourceFieldTypes)[number];

interface ResourceFieldOption {
  label: string;
  value: string;
}

interface ResourceField {
  key: string;
  label: string;
  type: ResourceFieldType;
  required?: boolean;
  default?: string | number | boolean;
  placeholder?: string;
  options?: ResourceFieldOption[];
  sensitive?: boolean;
}

interface ResourceSchema {
  fields?: ResourceField[];
}

interface ResourceType {
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

interface ResourceTypeFormData {
  key: string;
  name: string;
  category: string;
  description: string;
  approvalMode: string;
  provisioningMode: string;
  envTemplate: string;
}

interface EditableResourceField {
  key: string;
  label: string;
  type: ResourceFieldType;
  required: boolean;
  sensitive: boolean;
  placeholder: string;
  defaultValue: string;
  optionsText: string;
}

const fieldTypeLabels: Record<ResourceFieldType, string> = {
  text: '文本',
  number: '数字',
  password: '密码',
  textarea: '多行文本',
  select: '下拉选择',
  checkbox: '开关',
};

export default function ResourceTypesPage() {
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingType, setEditingType] = useState<ResourceType | null>(null);

  const loadData = async () => {
    try {
      const data = await api.get<ResourceType[]>('/resource-types?includeDisabled=true');
      setResourceTypes(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const closeModal = () => {
    setCreating(false);
    setEditingType(null);
  };

  const disableType = async (id: string) => {
    if (!confirm('确定要停用这个资源类型吗？')) return;
    await api.delete(`/resource-types/${id}`);
    loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">资源类型</h1>
          <p className="text-muted-foreground mt-1">定义可申请资源的表单、审批和交付方式</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          新增类型
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : resourceTypes.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <h3 className="text-lg font-medium">还没有资源类型</h3>
          <p className="text-muted-foreground mt-2">添加 MySQL、Redis、端口号或自定义账号资源</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium">分类</th>
                <th className="px-4 py-3 text-left text-sm font-medium">审批/交付</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Schema</th>
                <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {resourceTypes.map((type) => (
                <tr key={type.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{type.name}</div>
                    <code className="text-xs text-muted-foreground">{type.key}</code>
                    {type.description && (
                      <div className="text-xs text-muted-foreground mt-1">{type.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{type.category || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    <div>{type.approvalMode}</div>
                    <div className="text-xs text-muted-foreground">{type.provisioningMode}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div>申请 {getSchemaFieldCount(type.requestSchema)}</div>
                    <div className="text-xs text-muted-foreground">
                      交付 {getSchemaFieldCount(type.deliverySchema)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      type.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {type.enabled ? '启用' : '停用'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingType(type)}
                        className="px-2 py-1 text-xs rounded text-primary hover:bg-primary/10"
                      >
                        编辑
                      </button>
                      {type.enabled && (
                        <button
                          onClick={() => disableType(type.id)}
                          className="px-2 py-1 text-xs rounded text-destructive hover:bg-destructive/10"
                        >
                          停用
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editingType) && (
        <ResourceTypeFormModal
          resourceType={editingType}
          onClose={closeModal}
          onSuccess={() => {
            closeModal();
            loadData();
          }}
        />
      )}
    </div>
  );
}

function ResourceTypeFormModal({
  resourceType,
  onClose,
  onSuccess,
}: {
  resourceType: ResourceType | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<ResourceTypeFormData>(() => getInitialResourceTypeForm(resourceType));
  const [requestFields, setRequestFields] = useState<EditableResourceField[]>(
    () => toEditableFields(resourceType?.requestSchema),
  );
  const [deliveryFields, setDeliveryFields] = useState<EditableResourceField[]>(
    () => toEditableFields(resourceType?.deliverySchema),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEditing = Boolean(resourceType);

  useEffect(() => {
    setFormData(getInitialResourceTypeForm(resourceType));
    setRequestFields(toEditableFields(resourceType?.requestSchema));
    setDeliveryFields(toEditableFields(resourceType?.deliverySchema));
    setError('');
  }, [resourceType]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        category: formData.category || undefined,
        description: formData.description || undefined,
        approvalMode: formData.approvalMode,
        provisioningMode: formData.provisioningMode,
        requestSchema: buildResourceSchema(requestFields, '申请表单'),
        deliverySchema: buildResourceSchema(deliveryFields, '交付 Schema'),
        envTemplate: formData.envTemplate || undefined,
      };

      if (resourceType) {
        await api.put(`/resource-types/${resourceType.id}`, payload);
      } else {
        await api.post('/resource-types', {
          key: formData.key,
          ...payload,
        });
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存资源类型失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-5xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{isEditing ? '编辑资源类型' : '新增资源类型'}</h2>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Key</label>
              <input
                value={formData.key}
                onChange={(event) => setFormData({ ...formData, key: event.target.value })}
                required={!isEditing}
                disabled={isEditing}
                className="w-full px-3 py-2 border rounded-md disabled:bg-muted disabled:text-muted-foreground"
                placeholder="mysql"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">名称</label>
              <input
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                required
                className="w-full px-3 py-2 border rounded-md"
                placeholder="MySQL 数据库"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">分类</label>
              <input
                value={formData.category}
                onChange={(event) => setFormData({ ...formData, category: event.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">审批方式</label>
              <select
                value={formData.approvalMode}
                onChange={(event) => setFormData({ ...formData, approvalMode: event.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="manual">manual</option>
                <option value="auto">auto</option>
                <option value="none">none</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">交付方式</label>
              <select
                value={formData.provisioningMode}
                onChange={(event) => setFormData({ ...formData, provisioningMode: event.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="manual">manual</option>
                <option value="pool">pool</option>
                <option value="webhook">webhook</option>
                <option value="api">api</option>
                <option value="script">script</option>
                <option value="credential_only">credential_only</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">描述</label>
            <textarea
              value={formData.description}
              onChange={(event) => setFormData({ ...formData, description: event.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-md resize-none"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SchemaFieldsEditor
              title="申请表单"
              fields={requestFields}
              onChange={setRequestFields}
            />
            <SchemaFieldsEditor
              title="交付 Schema"
              fields={deliveryFields}
              onChange={setDeliveryFields}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">环境变量模板</label>
            <textarea
              value={formData.envTemplate}
              onChange={(event) => setFormData({ ...formData, envTemplate: event.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-md font-mono text-sm"
              placeholder="DATABASE_URL=mysql://${username}:${password}@${host}:${port}/${database}"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SchemaPreview title="申请 JSON" schema={buildPreviewSchema(requestFields)} />
            <SchemaPreview title="交付 JSON" schema={buildPreviewSchema(deliveryFields)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md">
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SchemaFieldsEditor({
  title,
  fields,
  onChange,
}: {
  title: string;
  fields: EditableResourceField[];
  onChange: (fields: EditableResourceField[]) => void;
}) {
  const updateField = (index: number, patch: Partial<EditableResourceField>) => {
    onChange(fields.map((field, fieldIndex) => fieldIndex === index ? normalizeEditableField({ ...field, ...patch }) : field));
  };

  const moveField = (index: number, offset: number) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= fields.length) {
      return;
    }
    const nextFields = [...fields];
    const [field] = nextFields.splice(index, 1);
    nextFields.splice(nextIndex, 0, field);
    onChange(nextFields);
  };

  return (
    <section className="rounded-md border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <div className="text-xs text-muted-foreground">{fields.length} 个字段</div>
        </div>
        <button
          type="button"
          onClick={() => onChange([...fields, createEmptyEditableField()])}
          title={`新增${title}字段`}
          aria-label={`新增${title}字段`}
          className="h-8 w-8 rounded-md border text-lg leading-none hover:bg-muted"
        >
          +
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
          暂无字段
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={index} className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-medium text-muted-foreground">#{index + 1}</div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveField(index, -1)}
                    disabled={index === 0}
                    title="上移"
                    aria-label="上移字段"
                    className="h-7 w-7 rounded-md border text-sm disabled:opacity-40 hover:bg-muted"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveField(index, 1)}
                    disabled={index === fields.length - 1}
                    title="下移"
                    aria-label="下移字段"
                    className="h-7 w-7 rounded-md border text-sm disabled:opacity-40 hover:bg-muted"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(fields.filter((_, fieldIndex) => fieldIndex !== index))}
                    title="删除"
                    aria-label="删除字段"
                    className="h-7 w-7 rounded-md border text-sm text-destructive hover:bg-destructive/10"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem] gap-3">
                <label className="text-sm">
                  <span className="block font-medium mb-1">Key</span>
                  <input
                    value={field.key}
                    onChange={(event) => updateField(index, { key: event.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="database"
                  />
                </label>
                <label className="text-sm">
                  <span className="block font-medium mb-1">名称</span>
                  <input
                    value={field.label}
                    onChange={(event) => updateField(index, { label: event.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="数据库名"
                  />
                </label>
                <label className="text-sm">
                  <span className="block font-medium mb-1">类型</span>
                  <select
                    value={field.type}
                    onChange={(event) => updateField(index, { type: event.target.value as ResourceFieldType })}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    {resourceFieldTypes.map((type) => (
                      <option key={type} value={type}>
                        {fieldTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="block font-medium mb-1">默认值</span>
                  {field.type === 'checkbox' ? (
                    <span className="flex h-10 items-center gap-2 px-3 py-2 border rounded-md bg-background">
                      <input
                        type="checkbox"
                        checked={field.defaultValue === 'true'}
                        onChange={(event) => updateField(index, { defaultValue: event.target.checked ? 'true' : '' })}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-muted-foreground">默认勾选</span>
                    </span>
                  ) : (
                    <input
                      value={field.defaultValue}
                      onChange={(event) => updateField(index, { defaultValue: event.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  )}
                </label>
                <label className="text-sm">
                  <span className="block font-medium mb-1">占位符</span>
                  <input
                    value={field.placeholder}
                    onChange={(event) => updateField(index, { placeholder: event.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </label>
              </div>

              {field.type === 'select' && (
                <label className="block text-sm">
                  <span className="block font-medium mb-1">选项</span>
                  <textarea
                    value={field.optionsText}
                    onChange={(event) => updateField(index, { optionsText: event.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-md font-mono text-sm resize-none"
                    placeholder={'small=小型\nlarge=大型'}
                  />
                </label>
              )}

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) => updateField(index, { required: event.target.checked })}
                    className="h-4 w-4"
                  />
                  必填
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={field.sensitive}
                    onChange={(event) => updateField(index, { sensitive: event.target.checked })}
                    className="h-4 w-4"
                  />
                  敏感
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SchemaPreview({ title, schema }: { title: string; schema: ResourceSchema }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{title}</label>
      <pre className="min-h-28 max-h-56 overflow-auto rounded-md border bg-muted/30 px-3 py-2 text-xs">
        {JSON.stringify(schema, null, 2)}
      </pre>
    </div>
  );
}

function getInitialResourceTypeForm(resourceType: ResourceType | null): ResourceTypeFormData {
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

function createEmptyEditableField(): EditableResourceField {
  return {
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

function normalizeEditableField(field: EditableResourceField): EditableResourceField {
  if (field.type === 'checkbox' && field.defaultValue !== 'true') {
    return { ...field, defaultValue: '' };
  }
  if (field.type !== 'select' && field.optionsText) {
    return { ...field, optionsText: '' };
  }
  return field;
}

function toEditableFields(schema?: ResourceSchema): EditableResourceField[] {
  return getSchemaFields(schema).map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    required: Boolean(field.required),
    sensitive: Boolean(field.sensitive),
    placeholder: field.placeholder || '',
    defaultValue: field.default === undefined || field.default === null ? '' : String(field.default),
    optionsText: formatOptionsText(field.options),
  }));
}

function getSchemaFieldCount(schema?: ResourceSchema) {
  return getSchemaFields(schema).length;
}

function getSchemaFields(schema?: ResourceSchema): ResourceField[] {
  const fields = schema?.fields;
  if (!Array.isArray(fields)) {
    return [];
  }
  return fields
    .filter((field) => Boolean(field?.key && field?.label))
    .map((field) => ({
      ...field,
      type: isResourceFieldType(field.type) ? field.type : 'text',
    }));
}

function isResourceFieldType(value: unknown): value is ResourceFieldType {
  return typeof value === 'string' && resourceFieldTypes.includes(value as ResourceFieldType);
}

function buildPreviewSchema(fields: EditableResourceField[]): ResourceSchema {
  try {
    return buildResourceSchema(fields, 'Schema');
  } catch {
    return { fields: [] };
  }
}

function buildResourceSchema(fields: EditableResourceField[], schemaName: string): ResourceSchema {
  const normalizedFields: ResourceField[] = [];
  const fieldKeys = new Set<string>();

  fields.forEach((field, index) => {
    if (!hasFieldInput(field)) {
      return;
    }

    const fieldLabel = field.label.trim();
    const fieldKey = field.key.trim();
    if (!fieldKey || !fieldLabel) {
      throw new Error(`${schemaName}第 ${index + 1} 个字段缺少 Key 或名称`);
    }
    if (fieldKeys.has(fieldKey)) {
      throw new Error(`${schemaName}字段 Key 重复：${fieldKey}`);
    }
    fieldKeys.add(fieldKey);

    const normalizedField: ResourceField = {
      key: fieldKey,
      label: fieldLabel,
      type: field.type,
    };

    if (field.required) {
      normalizedField.required = true;
    }
    if (field.sensitive) {
      normalizedField.sensitive = true;
    }
    if (field.placeholder.trim()) {
      normalizedField.placeholder = field.placeholder.trim();
    }
    if (field.defaultValue.trim()) {
      normalizedField.default = parseDefaultValue(field.defaultValue, field.type, `${schemaName}字段 ${fieldLabel}`);
    }
    if (field.type === 'select') {
      const options = parseOptions(field.optionsText);
      if (options.length === 0) {
        throw new Error(`${schemaName}字段 ${fieldLabel} 至少需要一个选项`);
      }
      normalizedField.options = options;
    }

    normalizedFields.push(normalizedField);
  });

  return { fields: normalizedFields };
}

function hasFieldInput(field: EditableResourceField) {
  return Boolean(
    field.key.trim()
      || field.label.trim()
      || field.placeholder.trim()
      || field.defaultValue.trim()
      || field.optionsText.trim()
      || field.required
      || field.sensitive,
  );
}

function parseDefaultValue(value: string, type: ResourceFieldType, label: string) {
  const trimmedValue = value.trim();
  if (type === 'checkbox') {
    if (['true', '1', 'yes'].includes(trimmedValue.toLowerCase())) {
      return true;
    }
    if (['false', '0', 'no'].includes(trimmedValue.toLowerCase())) {
      return false;
    }
    throw new Error(`${label} 的默认值需要是 true 或 false`);
  }
  if (type === 'number') {
    const numberValue = Number(trimmedValue);
    if (!Number.isFinite(numberValue)) {
      throw new Error(`${label} 的默认值需要是数字`);
    }
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
      if (optionValues.has(value)) {
        throw new Error(`选项值重复：${value}`);
      }
      optionValues.add(value);
      return { label, value };
    });
}

function formatOptionsText(options?: ResourceFieldOption[]) {
  if (!Array.isArray(options)) {
    return '';
  }
  return options
    .map((option) => {
      if (!option?.value) {
        return '';
      }
      return option.label && option.label !== option.value ? `${option.value}=${option.label}` : option.value;
    })
    .filter(Boolean)
    .join('\n');
}
