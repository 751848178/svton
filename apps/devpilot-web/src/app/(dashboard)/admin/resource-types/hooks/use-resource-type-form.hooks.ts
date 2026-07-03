/**
 * 资源类型表单 Hook
 *
 * 单一职责：维护资源类型表单编辑态、保存状态与提交 payload。
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useSetState, usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { ResourceType, ResourceTypeFormData, EditableResourceField } from '../types';
import { getInitialResourceTypeForm, toEditableFields, buildResourceSchema } from '../utils';

interface UseResourceTypeFormOptions {
  resourceType: ResourceType | null;
  onSuccess: () => void;
}

export function useResourceTypeForm({ resourceType, onSuccess }: UseResourceTypeFormOptions) {
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

  const handleSubmit = usePersistFn(async (event: FormEvent<HTMLFormElement>) => {
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

  return {
    deliveryFields,
    error,
    formData,
    handleSubmit,
    isEditing,
    requestFields,
    saving,
    setDeliveryFields,
    setFormData,
    setRequestFields,
  };
}
