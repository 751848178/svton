/**
 * 资源类型表单字段
 *
 * 单一职责：渲染资源类型基础字段、Schema 编辑器、预览和提交操作。
 */

import type { EditableResourceField, ResourceTypeFormData } from '../types';
import { buildPreviewSchema } from '../utils';
import { SchemaFieldsEditor, SchemaPreview } from './schema-fields-editor';

interface ResourceTypeFormFieldsProps {
  deliveryFields: EditableResourceField[];
  formData: ResourceTypeFormData;
  isEditing: boolean;
  requestFields: EditableResourceField[];
  saving: boolean;
  onCancel: () => void;
  onDeliveryFieldsChange: (fields: EditableResourceField[]) => void;
  onFormDataChange: (patch: Partial<ResourceTypeFormData>) => void;
  onRequestFieldsChange: (fields: EditableResourceField[]) => void;
}

export function ResourceTypeFormFields({
  deliveryFields,
  formData,
  isEditing,
  requestFields,
  saving,
  onCancel,
  onDeliveryFieldsChange,
  onFormDataChange,
  onRequestFieldsChange,
}: ResourceTypeFormFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Key</span>
          <input
            value={formData.key}
            onChange={(event) => onFormDataChange({ key: event.target.value })}
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
            onChange={(event) => onFormDataChange({ name: event.target.value })}
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
            onChange={(event) => onFormDataChange({ category: event.target.value })}
            className="w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">审批方式</span>
          <select
            value={formData.approvalMode}
            onChange={(event) => onFormDataChange({ approvalMode: event.target.value })}
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
            onChange={(event) => onFormDataChange({ provisioningMode: event.target.value })}
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
          onChange={(event) => onFormDataChange({ description: event.target.value })}
          rows={2}
          className="w-full resize-none rounded-md border px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SchemaFieldsEditor
          title="申请表单"
          fields={requestFields}
          onChange={onRequestFieldsChange}
        />
        <SchemaFieldsEditor
          title="交付 Schema"
          fields={deliveryFields}
          onChange={onDeliveryFieldsChange}
        />
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">环境变量模板</span>
        <textarea
          value={formData.envTemplate}
          onChange={(event) => onFormDataChange({ envTemplate: event.target.value })}
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
          onClick={onCancel}
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
    </>
  );
}
