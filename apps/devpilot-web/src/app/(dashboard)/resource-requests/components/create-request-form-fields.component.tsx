import { useTranslations } from 'next-intl';
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
  const t = useTranslations('resourceRequests');
  const tc = useTranslations('common');
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1">{t('resourceType')}</label>
        <select
          value={formData.resourceTypeId}
          onChange={(event) => onFormDataChange({ resourceTypeId: event.target.value })}
          required
          className="w-full px-3 py-2 border rounded-md bg-background"
        >
          {resourceTypes.length === 0 && <option value="">{t('noResourceTypes')}</option>}
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
          {t('enableResourceTypeHint')}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium mb-1">{t('requestTitle')}</label>
        <input
          value={formData.title}
          onChange={(event) => onFormDataChange({ title: event.target.value })}
          required
          className="w-full px-3 py-2 border rounded-md"
          placeholder={t('requestTitlePlaceholder')}
        />
      </div>
      <div
        className={`grid gap-3 ${hasEnvironmentField ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}
      >
        <div>
          <label className="block text-sm font-medium mb-1">{t('project')}</label>
          <select
            value={formData.projectId}
            onChange={(event) => onFormDataChange({ projectId: event.target.value })}
            className="w-full px-3 py-2 border rounded-md bg-background"
          >
            <option value="">{t('noProject')}</option>
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
            <label className="block text-sm font-medium mb-1">{t('environment')}</label>
            <input
              value={formData.environment}
              onChange={(event) => onFormDataChange({ environment: event.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              placeholder={t('environmentPlaceholder')}
            />
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t('purpose')}</label>
        <textarea
          value={formData.purpose}
          onChange={(event) => onFormDataChange({ purpose: event.target.value })}
          rows={3}
          className="w-full px-3 py-2 border rounded-md resize-none"
        />
      </div>
      {fields.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm font-medium">{t('requestSpec')}</div>
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
          <label className="block text-sm font-medium mb-1">{t('specJson')}</label>
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
          {tc('cancel')}
        </button>
        <button
          type="submit"
          disabled={saving || !formData.resourceTypeId}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
        >
          {saving ? t('submitting') : t('submitRequest')}
        </button>
      </div>
    </>
  );
}
