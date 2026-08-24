import { useTranslations } from 'next-intl';
import { Input, Select, Textarea } from '@/components/ui';
import type { CreateRequestFormData } from '../hooks/use-create-request-form.hooks';
import type {
  Project,
  ProjectEnvironment,
  ResourceField,
  ResourceFieldValue,
  ResourceType,
} from '../types';
import { getFieldDefaultValue } from '../utils';
import { DynamicResourceField } from './dynamic-resource-field';

interface CreateRequestFormFieldsProps {
  fields: ResourceField[];
  fieldValues: Record<string, ResourceFieldValue>;
  formData: CreateRequestFormData;
  projects: Project[];
  environments: ProjectEnvironment[];
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
  projects,
  environments,
  resourceTypes,
  saving,
  onCancel,
  onFieldValueChange,
  onFormDataChange,
}: CreateRequestFormFieldsProps) {
  const t = useTranslations('resourceRequests');
  const tc = useTranslations('common');
  const projectEnvironments = environments.filter(
    (environment) => environment.project?.id === formData.projectId,
  );
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1">{t('resourceType')}</label>
        <Select
          value={formData.resourceTypeId}
          onChange={(event) => onFormDataChange({ resourceTypeId: event.target.value })}
          required
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
        </Select>
      </div>
      {resourceTypes.length === 0 && (
        <div className="p-3 rounded-md bg-muted text-sm text-muted-foreground">
          {t('enableResourceTypeHint')}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium mb-1">{t('requestTitle')}</label>
        <Input
          value={formData.title}
          onChange={(event) => onFormDataChange({ title: event.target.value })}
          required
          placeholder={t('requestTitlePlaceholder')}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">{t('project')}</label>
          <Select
            value={formData.projectId}
            onChange={(event) =>
              onFormDataChange({ projectId: event.target.value, environmentId: '' })
            }
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
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('environment')}</label>
          <Select
            value={formData.environmentId}
            onChange={(event) => onFormDataChange({ environmentId: event.target.value })}
            disabled={!formData.projectId}
            required={Boolean(formData.projectId)}
          >
            <option value="">
              {formData.projectId ? t('selectProjectEnvironment') : t('selectProjectFirst')}
            </option>
            {projectEnvironments.map((environment) => (
              <option
                key={environment.id}
                value={environment.id}
              >
                {environment.name} ({environment.key})
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">{t('environmentAssociationHint')}</p>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t('purpose')}</label>
        <Textarea
          value={formData.purpose}
          onChange={(event) => onFormDataChange({ purpose: event.target.value })}
          rows={3}
          className="resize-none"
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
          <Textarea
            value={formData.spec}
            onChange={(event) => onFormDataChange({ spec: event.target.value })}
            rows={6}
            className="font-mono"
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
