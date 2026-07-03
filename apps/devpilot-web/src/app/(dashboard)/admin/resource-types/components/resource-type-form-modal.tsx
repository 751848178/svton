/**
 * 资源类型表单弹窗
 *
 * 单一职责：新增/编辑资源类型（含 Schema 字段编辑器、预览）。
 */

import { Modal, ErrorBanner } from '@/components/ui';
import type { ResourceType } from '../types';
import { useResourceTypeForm } from '../hooks/use-resource-type-form.hooks';
import { ResourceTypeFormFields } from './resource-type-form-fields.component';

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
  const form = useResourceTypeForm({
    resourceType,
    onSuccess,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={form.isEditing ? '编辑资源类型' : '新增资源类型'}
      width={1024}
    >
      <form
        onSubmit={form.handleSubmit}
        className="space-y-5"
      >
        {form.error ? (
          <ErrorBanner
            message={form.error}
            variant="inline"
          />
        ) : null}

        <ResourceTypeFormFields
          deliveryFields={form.deliveryFields}
          formData={form.formData}
          isEditing={form.isEditing}
          requestFields={form.requestFields}
          saving={form.saving}
          onCancel={onClose}
          onDeliveryFieldsChange={form.setDeliveryFields}
          onFormDataChange={form.setFormData}
          onRequestFieldsChange={form.setRequestFields}
        />
      </form>
    </Modal>
  );
}
