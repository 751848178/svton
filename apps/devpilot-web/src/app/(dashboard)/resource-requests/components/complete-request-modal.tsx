/** 完成交付弹窗 - 动态表单（按交付 Schema）。 */
'use client';
import { useCompleteRequestForm } from '../hooks/use-complete-request-form.hooks';
import type { ResourceRequest } from '../types';
import { CompleteRequestFormFields } from './complete-request-form-fields.component';

export function CompleteRequestModal({
  request,
  onClose,
  onSuccess,
}: {
  request: ResourceRequest;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const form = useCompleteRequestForm({ request, onSuccess });

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

        {form.error && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {form.error}
          </div>
        )}

        <form
          onSubmit={form.handleSubmit}
          className="space-y-4 mt-4"
        >
          <CompleteRequestFormFields
            deliveryFields={form.deliveryFields}
            fieldValues={form.fieldValues}
            formData={form.formData}
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
