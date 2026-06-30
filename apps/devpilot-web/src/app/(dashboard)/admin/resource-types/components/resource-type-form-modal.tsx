/**
 * 资源类型表单弹窗
 *
 * 单一职责：新增/编辑资源类型（含 Schema 字段编辑器、预览）。
 */

import { useEffect, useState } from 'react';
import { useSetState, usePersistFn } from '@svton/hooks';
import { Modal, ErrorBanner } from '@/components/ui';
import { apiRequest } from '@/lib/api-client';
import type { ResourceType, ResourceTypeFormData, EditableResourceField } from '../types';
import {
  getInitialResourceTypeForm,
  toEditableFields,
  buildResourceSchema,
  buildPreviewSchema,
} from '../utils';
import { SchemaFieldsEditor, SchemaPreview } from './schema-fields-editor';

interface ResourceTypeFormModalProps {
  open: boolean;
  resourceType: ResourceType | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ResourceTypeFormModal({
  open,
  resourceType,
  onClose,
  onSuccess,
}: ResourceTypeFormModalProps) {
  const [formData, setFormData] = useSetState<ResourceTypeFormData>(() =>
    getInitialResourceTypeForm(resourceType),
  );
  const [requestFields, setRequestFields] = useState<EditableResourceField[]>(() =>
    toEditableFields(resourceType?.requestSchema),
  );
  const [deliveryFields, setDeliveryFields] = useState<EditableResourceField[]>(() =>
    toEditableFields(resourceType?.deliverySchema),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEditing = Boolean(resourceType);

  useEffect(() => {
    setFormData(getInitialResourceTypeForm(resourceType));
    setRequestFields(toEditableFields(resourceType?.requestSchema));
    setDeliveryFields(toEditableFields(resourceType?.deliverySchema));
    setError('');
  }, [resourceType, setFormData]);

  const handleSubmit = usePersistFn(async (event: React.FormEvent) => {
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
        await apiRequest(`PUT:/resource-types/${resourceType.id}`, payload);
      } else {
        await apiRequest('POST:/resource-types', { key: formData.key, ...payload });
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存资源类型失败');
    } finally {
      setSaving(false);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? '编辑资源类型' : '新增资源类型'}
      width={1024}
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {error ? (
          <ErrorBanner
            message={error}
            variant="inline"
          />
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Key</span>
            <input
              value={formData.key}
              onChange={(e) => setFormData({ key: e.target.value })}
              required={!isEditing}
              disabled={isEditing}
              className="w-full rounded-md border px-3 py-2 disabled:bg-muted disabled:text-muted-foreground"
              placeholder="mysql"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">名称</span>
            <input
              value={formData.name}
              onChange={(e) => setFormData({ name: e.target.value })}
              required
              className="w-full rounded-md border px-3 py-2"
              placeholder="MySQL 数据库"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">分类</span>
            <input
              value={formData.category}
              onChange={(e) => setFormData({ category: e.target.value })}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">审批方式</span>
            <select
              value={formData.approvalMode}
              onChange={(e) => setFormData({ approvalMode: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="manual">manual</option>
              <option value="auto">auto</option>
              <option value="none">none</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">交付方式</span>
            <select
              value={formData.provisioningMode}
              onChange={(e) => setFormData({ provisioningMode: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="manual">manual</option>
              <option value="pool">pool</option>
              <option value="webhook">webhook</option>
              <option value="api">api</option>
              <option value="script">script</option>
              <option value="credential_only">credential_only</option>
              <option value="provider">provider</option>
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">描述</span>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ description: e.target.value })}
            rows={2}
            className="w-full resize-none rounded-md border px-3 py-2"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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

        <label className="block text-sm">
          <span className="mb-1 block font-medium">环境变量模板</span>
          <textarea
            value={formData.envTemplate}
            onChange={(e) => setFormData({ envTemplate: e.target.value })}
            rows={3}
            className="w-full rounded-md border px-3 py-2 font-mono text-sm"
            placeholder="DATABASE_URL=mysql://${username}:${password}@${host}:${port}/${database}"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <SchemaPreview
            title="申请 JSON"
            schema={buildPreviewSchema(requestFields)}
          />
          <SchemaPreview
            title="交付 JSON"
            schema={buildPreviewSchema(deliveryFields)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
