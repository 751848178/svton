import { useTranslations } from 'next-intl';
import { Checkbox, Input, Textarea } from '@/components/ui';
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
  const t = useTranslations('resourceRequests');
  const tc = useTranslations('common');
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">{t('instanceNameLabel')}</label>
          <Input
            value={formData.instanceName}
            onChange={(event) => onFormDataChange({ instanceName: event.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('expiresAtLabel')}</label>
          <Input
            type="datetime-local"
            value={formData.expiresAt}
            onChange={(event) => onFormDataChange({ expiresAt: event.target.value })}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={formData.createInstance}
          onChange={(event) => onFormDataChange({ createInstance: event.target.checked })}
        />
        {t('createInstanceAndLink')}
      </label>

      {deliveryFields.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm font-medium">{t('deliveryInfo')}</div>
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
            <label className="block text-sm font-medium mb-1">{t('deliveryInfoJson')}</label>
            <Textarea
              value={formData.delivery}
              onChange={(event) => onFormDataChange({ delivery: event.target.value })}
              rows={6}
              className="font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('credentialsJson')}</label>
            <Textarea
              value={formData.credentials}
              onChange={(event) => onFormDataChange({ credentials: event.target.value })}
              rows={6}
              className="font-mono"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">{t('instanceConfigJson')}</label>
        <Textarea
          value={formData.config}
          onChange={(event) => onFormDataChange({ config: event.target.value })}
          rows={3}
          className="font-mono"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded-md"
        >
          {tc('cancel')}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
        >
          {saving ? t('delivering') : t('confirmDelivery')}
        </button>
      </div>
    </>
  );
}
