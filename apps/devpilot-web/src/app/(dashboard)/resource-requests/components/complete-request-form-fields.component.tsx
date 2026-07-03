import type { CompleteRequestFormData } from '../hooks/use-complete-request-form.hooks';
import type { ResourceField, ResourceFieldValue } from '../types';
import { getFieldDefaultValue } from '../utils';
import { DynamicResourceField } from './dynamic-resource-field';

interface CompleteRequestFormFieldsProps {
  deliveryFields: ResourceField[];
  fieldValues: Record<string, ResourceFieldValue>;
  formData: CompleteRequestFormData;
  saving: boolean;
  onCancel: () => void;
  onFieldValueChange: (key: string, value: ResourceFieldValue) => void;
  onFormDataChange: (patch: Partial<CompleteRequestFormData>) => void;
}

export function CompleteRequestFormFields({
  deliveryFields,
  fieldValues,
  formData,
  saving,
  onCancel,
  onFieldValueChange,
  onFormDataChange,
}: CompleteRequestFormFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">实例名称</label>
          <input
            value={formData.instanceName}
            onChange={(event) => onFormDataChange({ instanceName: event.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">过期时间</label>
          <input
            type="datetime-local"
            value={formData.expiresAt}
            onChange={(event) => onFormDataChange({ expiresAt: event.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={formData.createInstance}
          onChange={(event) => onFormDataChange({ createInstance: event.target.checked })}
          className="h-4 w-4"
        />
        创建资源实例并关联申请
      </label>

      {deliveryFields.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm font-medium">交付信息</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {deliveryFields.map((field) => (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">交付信息 JSON</label>
            <textarea
              value={formData.delivery}
              onChange={(event) => onFormDataChange({ delivery: event.target.value })}
              rows={6}
              className="w-full px-3 py-2 border rounded-md font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">敏感凭证 JSON</label>
            <textarea
              value={formData.credentials}
              onChange={(event) => onFormDataChange({ credentials: event.target.value })}
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
          onChange={(event) => onFormDataChange({ config: event.target.value })}
          rows={3}
          className="w-full px-3 py-2 border rounded-md font-mono text-sm"
        />
      </div>

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
          disabled={saving}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
        >
          {saving ? '交付中...' : '确认交付'}
        </button>
      </div>
    </>
  );
}
