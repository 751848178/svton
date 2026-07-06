/**
 * 资源类型表单 Hook
 *
 * 单一职责：维护资源类型表单编辑态、保存状态与提交 payload。
 *
 * react-hook-form 样板：取代手写 useSetState + 多个 useState。
 * 主表单字段（key/name/category/description/approvalMode/provisioningMode/envTemplate）走 react-hook-form；
 * 动态字段定义（requestFields/deliveryFields，由 Schema 编辑器增删行）用受控 useState 维护，
 * 因为 react-hook-form 的 register 难以处理运行时才知道数量/Key 的字段集合。
 *
 * 对外暴露与旧 hook 兼容的 shape，使 ResourceTypeFormModal / ResourceTypeFormFields 改动最小。
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { apiRequest } from '@/lib/api-client';
import type { ResourceType, ResourceTypeFormData, EditableResourceField } from '../types';
import { getInitialResourceTypeForm, toEditableFields, buildResourceSchema } from '../utils';

interface UseResourceTypeFormOptions {
  resourceType: ResourceType | null;
  onSuccess: () => void;
}

export function useResourceTypeForm({ resourceType, onSuccess }: UseResourceTypeFormOptions) {
  const { register, handleSubmit, watch, setValue, reset, setError, formState } = useForm<ResourceTypeFormData>({
    defaultValues: getInitialResourceTypeForm(resourceType),
  });

  const [requestFields, setRequestFields] = useState<EditableResourceField[]>(() =>
    toEditableFields(resourceType?.requestSchema),
  );
  const [deliveryFields, setDeliveryFields] = useState<EditableResourceField[]>(() =>
    toEditableFields(resourceType?.deliverySchema),
  );
  const isEditing = Boolean(resourceType);

  // resourceType 变化（新增/编辑切换）时重置静态字段与动态字段定义。
  useEffect(() => {
    reset(getInitialResourceTypeForm(resourceType));
    setRequestFields(toEditableFields(resourceType?.requestSchema));
    setDeliveryFields(toEditableFields(resourceType?.deliverySchema));
    setError('root', { message: '' });
  }, [resourceType, reset, setError]);

  const formData = watch();

  const setFormData = (patch: Partial<ResourceTypeFormData>) => {
    (Object.keys(patch) as (keyof ResourceTypeFormData)[]).forEach((key) => {
      setValue(key, patch[key] as never);
    });
  };

  const submit = handleSubmit(async (data) => {
    try {
      const payload: Record<string, unknown> = {
        name: data.name,
        category: data.category || undefined,
        description: data.description || undefined,
        approvalMode: data.approvalMode,
        provisioningMode: data.provisioningMode,
        requestSchema: buildResourceSchema(requestFields, '申请表单'),
        deliverySchema: buildResourceSchema(deliveryFields, '交付 Schema'),
        envTemplate: data.envTemplate || undefined,
      };
      if (resourceType) {
        await apiRequest(`PUT:/resource-types/${resourceType.id}`, payload);
      } else {
        await apiRequest('POST:/resource-types', { key: data.key, ...payload });
      }
      onSuccess();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : '保存资源类型失败' });
    }
  });

  return {
    deliveryFields,
    error: (formState.errors.root as { message?: string } | undefined)?.message || '',
    formData,
    handleSubmit: submit,
    isEditing,
    register,
    requestFields,
    saving: formState.isSubmitting,
    setDeliveryFields,
    setFormData,
    setRequestFields,
  };
}
