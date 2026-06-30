/** 创建资源申请弹窗 - 动态表单 + JSON spec。 */
'use client';
import { useEffect, useMemo, useState } from 'react';
import { Modal, ErrorBanner } from '@/components/ui';
import { apiRequest } from '@/lib/api-client';
import type { ResourceType, Project, ResourceFieldValue } from '../types';
import {
  getSchemaFields,
  getResourceFields,
  getFieldDefaultValue,
  buildInitialValuesFromFields,
  buildInitialFieldValues,
  buildPayloadFromFields,
  buildSpecFromFields,
  parseJsonObject,
} from '../utils';
import { DynamicResourceField } from './dynamic-resource-field';
export function CreateRequestModal({
  resourceTypes,
  projects,
  onClose,
  onSuccess,
}: {
  resourceTypes: ResourceType[];
  projects: Project[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    resourceTypeId: resourceTypes[0]?.id || '',
    projectId: '',
    title: '',
    environment: 'dev',
    purpose: '',
    spec: '{}',
  });
  const selectedResourceType = useMemo(
    () => resourceTypes.find((type) => type.id === formData.resourceTypeId),
    [formData.resourceTypeId, resourceTypes],
  );
  const fields = useMemo(() => getResourceFields(selectedResourceType), [selectedResourceType]);
  const hasEnvironmentField = fields.some((field) => field.key === 'environment');
  const [fieldValues, setFieldValues] = useState<Record<string, ResourceFieldValue>>(() =>
    buildInitialFieldValues(resourceTypes[0]),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const initialValues = buildInitialFieldValues(selectedResourceType);
    setFieldValues(initialValues);
    if (typeof initialValues.environment === 'string' && initialValues.environment) {
      setFormData((current) => ({ ...current, environment: initialValues.environment as string }));
    }
  }, [selectedResourceType]);
  const updateFieldValue = (key: string, value: ResourceFieldValue) => {
    setFieldValues((current) => ({ ...current, [key]: value }));
    if (key === 'environment' && typeof value === 'string') {
      setFormData((current) => ({ ...current, environment: value }));
    }
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const spec =
        fields.length > 0
          ? buildSpecFromFields(fields, fieldValues)
          : JSON.parse(formData.spec || '{}');
      await apiRequest('POST:/resource-requests', {
        resourceTypeId: formData.resourceTypeId,
        projectId: formData.projectId || undefined,
        title: formData.title,
        environment: formData.environment || undefined,
        purpose: formData.purpose || undefined,
        spec,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建申请失败，请检查 JSON 格式');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">新建资源申请</h2>
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">资源类型</label>
            <select
              value={formData.resourceTypeId}
              onChange={(event) => setFormData({ ...formData, resourceTypeId: event.target.value })}
              required
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              {resourceTypes.length === 0 && <option value="">暂无可用资源类型</option>}
              {resourceTypes.map((type) => (
                <option
                  key={type.id}
                  value={type.id}
                >
                  {type.name} ({type.key})
                </option>
              ))}
            </select>
          </div>
          {resourceTypes.length === 0 && (
            <div className="p-3 rounded-md bg-muted text-sm text-muted-foreground">
              请先在资源类型中新增或启用资源类型。
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">申请标题</label>
            <input
              value={formData.title}
              onChange={(event) => setFormData({ ...formData, title: event.target.value })}
              required
              className="w-full px-3 py-2 border rounded-md"
              placeholder="申请 dev 环境 Redis"
            />
          </div>
          <div className={`grid gap-3 ${hasEnvironmentField ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div>
              <label className="block text-sm font-medium mb-1">关联项目</label>
              <select
                value={formData.projectId}
                onChange={(event) => setFormData({ ...formData, projectId: event.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="">不关联</option>
                {projects.map((project) => (
                  <option
                    key={project.id}
                    value={project.id}
                  >
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            {!hasEnvironmentField && (
              <div>
                <label className="block text-sm font-medium mb-1">环境</label>
                <input
                  value={formData.environment}
                  onChange={(event) =>
                    setFormData({ ...formData, environment: event.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="dev / test / prod"
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">用途</label>
            <textarea
              value={formData.purpose}
              onChange={(event) => setFormData({ ...formData, purpose: event.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-md resize-none"
            />
          </div>
          {fields.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-medium">申请规格</div>
              <div className="grid grid-cols-2 gap-3">
                {fields.map((field) => (
                  <DynamicResourceField
                    key={field.key}
                    field={field}
                    value={fieldValues[field.key] ?? getFieldDefaultValue(field)}
                    onChange={(value) => updateFieldValue(field.key, value)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">规格 JSON</label>
              <textarea
                value={formData.spec}
                onChange={(event) => setFormData({ ...formData, spec: event.target.value })}
                rows={6}
                className="w-full px-3 py-2 border rounded-md font-mono text-sm"
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-md"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving || !formData.resourceTypeId}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
            >
              {saving ? '提交中...' : '提交申请'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
