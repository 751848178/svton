import type { CreateRequestFormData } from '../hooks/use-create-request-form.hooks';
import type { Project, ResourceField, ResourceFieldValue, ResourceType } from '../types';
import { getFieldDefaultValue } from '../utils';
import { DynamicResourceField } from './dynamic-resource-field';

interface CreateRequestFormFieldsProps {
  fields: ResourceField[];
  fieldValues: Record<string, ResourceFieldValue>;
  formData: CreateRequestFormData;
  hasEnvironmentField: boolean;
  projects: Project[];
  resourceTypes: ResourceType[];
  saving: boolean;
  onCancel: () => void;
  onFieldValueChange: (key: string, value: ResourceFieldValue) => void;
  onFormDataChange: (patch: Partial<CreateRequestFormData>) => void;
}

export function CreateRequestFormFields({
  fields,
  fieldValues,
  formData,
  hasEnvironmentField,
  projects,
  resourceTypes,
  saving,
  onCancel,
  onFieldValueChange,
  onFormDataChange,
}: CreateRequestFormFieldsProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1">资源类型</label>
        <select
          value={formData.resourceTypeId}
          onChange={(event) => onFormDataChange({ resourceTypeId: event.target.value })}
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
          onChange={(event) => onFormDataChange({ title: event.target.value })}
          required
          className="w-full px-3 py-2 border rounded-md"
          placeholder="申请 dev 环境 Redis"
        />
      </div>
      <div
        className={`grid gap-3 ${hasEnvironmentField ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}
      >
        <div>
          <label className="block text-sm font-medium mb-1">关联项目</label>
          <select
            value={formData.projectId}
            onChange={(event) => onFormDataChange({ projectId: event.target.value })}
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
              onChange={(event) => onFormDataChange({ environment: event.target.value })}
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
          onChange={(event) => onFormDataChange({ purpose: event.target.value })}
          rows={3}
          className="w-full px-3 py-2 border rounded-md resize-none"
        />
      </div>
      {fields.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm font-medium">申请规格</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((field) => (
              <DynamicResourceField
                key={field.key}
                field={field}
                value={fieldValues[field.key] ?? getFieldDefaultValue(field)}
                onChange={(value) => onFieldValueChange(field.key, value)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-1">规格 JSON</label>
          <textarea
            value={formData.spec}
            onChange={(event) => onFormDataChange({ spec: event.target.value })}
            rows={6}
            className="w-full px-3 py-2 border rounded-md font-mono text-sm"
          />
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
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
    </>
  );
}
