/** 创建资源申请弹窗 - 动态表单 + JSON spec。 */
'use client';
import { useTranslations } from 'next-intl';
import type { Project, ResourceType } from '../types';
import { useCreateRequestForm } from '../hooks/use-create-request-form.hooks';
import { CreateRequestFormFields } from './create-request-form-fields.component';

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
  const t = useTranslations('resourceRequests');
  const form = useCreateRequestForm({ resourceTypes, onSuccess });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{t('createRequestTitle')}</h2>
        {form.error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {form.error}
          </div>
        )}
        <form
          onSubmit={form.handleSubmit}
          className="space-y-4"
        >
          <CreateRequestFormFields
            fields={form.fields}
            fieldValues={form.fieldValues}
            formData={form.formData}
            hasEnvironmentField={form.hasEnvironmentField}
            projects={projects}
            resourceTypes={resourceTypes}
            saving={form.saving}
            onCancel={onClose}
            onFieldValueChange={form.updateFieldValue}
            onFormDataChange={form.updateFormData}
          />
        </form>
      </div>
    </div>
  );
}
