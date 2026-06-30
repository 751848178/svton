/** 完成交付弹窗 - 动态表单（按交付 Schema）。 */
'use client';
import { useEffect, useMemo, useState } from 'react';
import { Modal, ErrorBanner } from '@/components/ui';
import { apiRequest } from '@/lib/api-client';
import type { ResourceRequest, ResourceFieldValue } from '../types';
import {
  getSchemaFields,
  getResourceFields,
  getFieldDefaultValue,
  buildInitialValuesFromFields,
  buildInitialFieldValues,
  buildPayloadFromFields,
  parseJsonObject,
} from '../utils';
import { DynamicResourceField } from './dynamic-resource-field';

export function CompleteRequestModal({
  request,
  onClose,
  onSuccess,
}: {
  request: ResourceRequest;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const deliveryFields = useMemo(
    () => getSchemaFields(request.resourceType?.deliverySchema),
    [request.resourceType?.deliverySchema],
  );
  const [fieldValues, setFieldValues] = useState<Record<string, ResourceFieldValue>>(() =>
    buildInitialValuesFromFields(deliveryFields),
  );
  const [formData, setFormData] = useState({
    instanceName: request.title,
    expiresAt: '',
    createInstance: true,
    config: '{}',
    delivery: '{}',
    credentials: '{}',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFieldValues(buildInitialValuesFromFields(deliveryFields));
  }, [deliveryFields]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      const config = parseJsonObject(formData.config, '实例配置');
      const delivery =
        deliveryFields.length > 0
          ? buildPayloadFromFields(deliveryFields, fieldValues, (field) => !field.sensitive)
          : parseJsonObject(formData.delivery, '交付信息');
      const credentials =
        deliveryFields.length > 0
          ? buildPayloadFromFields(deliveryFields, fieldValues, (field) => Boolean(field.sensitive))
          : parseJsonObject(formData.credentials, '敏感凭证');

      await apiRequest(`POST:/resource-requests/${request.id}/complete`, {
        instanceName: formData.instanceName || request.title,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined,
        createInstance: formData.createInstance,
        config,
        delivery,
        credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '交付失败，请检查表单内容');
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
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold">交付资源</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {request.title} · {request.resourceType?.name || '资源'}
        </p>

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 mt-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">实例名称</label>
              <input
                value={formData.instanceName}
                onChange={(event) => setFormData({ ...formData, instanceName: event.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">过期时间</label>
              <input
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(event) => setFormData({ ...formData, expiresAt: event.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.createInstance}
              onChange={(event) =>
                setFormData({ ...formData, createInstance: event.target.checked })
              }
              className="h-4 w-4"
            />
            创建资源实例并关联申请
          </label>

          {deliveryFields.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-medium">交付信息</div>
              <div className="grid grid-cols-2 gap-3">
                {deliveryFields.map((field) => (
                  <DynamicResourceField
                    key={field.key}
                    field={field}
                    value={fieldValues[field.key] ?? getFieldDefaultValue(field)}
                    onChange={(value) =>
                      setFieldValues((current) => ({ ...current, [field.key]: value }))
                    }
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">交付信息 JSON</label>
                <textarea
                  value={formData.delivery}
                  onChange={(event) => setFormData({ ...formData, delivery: event.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border rounded-md font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">敏感凭证 JSON</label>
                <textarea
                  value={formData.credentials}
                  onChange={(event) =>
                    setFormData({ ...formData, credentials: event.target.value })
                  }
                  rows={6}
                  className="w-full px-3 py-2 border rounded-md font-mono text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">实例配置 JSON</label>
            <textarea
              value={formData.config}
              onChange={(event) => setFormData({ ...formData, config: event.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-md font-mono text-sm"
            />
          </div>

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
              disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
            >
              {saving ? '交付中...' : '确认交付'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
