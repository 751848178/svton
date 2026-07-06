/**
 * 完成交付表单状态（react-hook-form）。
 *
 * 取代原多个 useState + 手写 setFormData/fieldValues 的手搓表单状态。
 * 主表单字段（instanceName/expiresAt/createInstance/config/delivery/credentials）走 react-hook-form；
 * 动态交付字段（key 来自所选 resourceType 的 deliverySchema，运行时变化）用一个受控 map 维护，
 * 因为 react-hook-form 的 register 难以处理运行时才知道 key 的字段集合。
 *
 * 对外暴露与旧 hook 兼容的 shape，使 CompleteRequestModal / CompleteRequestFormFields 改动最小。
 */
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { apiRequest } from '@/lib/api-client';
import type { ResourceFieldValue, ResourceRequest } from '../types';
import {
  buildInitialValuesFromFields,
  buildPayloadFromFields,
  getSchemaFields,
  parseJsonObject,
} from '../utils';

export interface CompleteRequestFormData {
  instanceName: string;
  expiresAt: string;
  createInstance: boolean;
  config: string;
  delivery: string;
  credentials: string;
}

interface UseCompleteRequestFormOptions {
  request: ResourceRequest;
  onSuccess: () => void;
}

export function useCompleteRequestForm({ request, onSuccess }: UseCompleteRequestFormOptions) {
  const deliveryFields = useMemo(
    () => getSchemaFields(request.resourceType?.deliverySchema),
    [request.resourceType?.deliverySchema],
  );

  const { register, handleSubmit, watch, setValue, setError, formState } = useForm<CompleteRequestFormData>({
    defaultValues: {
      instanceName: request.title,
      expiresAt: '',
      createInstance: true,
      config: '{}',
      delivery: '{}',
      credentials: '{}',
    },
  });

  // 动态字段：key 随所选 resourceType 的 deliverySchema 变化，无法静态 register；用单一受控 map 管理。
  const [fieldValues, setFieldValues] = useState<Record<string, ResourceFieldValue>>(() =>
    buildInitialValuesFromFields(deliveryFields),
  );

  useEffect(() => {
    setFieldValues(buildInitialValuesFromFields(deliveryFields));
  }, [deliveryFields]);

  const formData = watch();

  const updateFormData = (patch: Partial<CompleteRequestFormData>) => {
    (Object.keys(patch) as (keyof CompleteRequestFormData)[]).forEach((key) => {
      setValue(key, patch[key] as never);
    });
  };

  const updateFieldValue = (key: string, value: ResourceFieldValue) => {
    setFieldValues((current) => ({ ...current, [key]: value }));
  };

  const submit = handleSubmit(async (data) => {
    try {
      const config = parseJsonObject(data.config, '实例配置');
      const delivery =
        deliveryFields.length > 0
          ? buildPayloadFromFields(deliveryFields, fieldValues, (field) => !field.sensitive)
          : parseJsonObject(data.delivery, '交付信息');
      const credentials =
        deliveryFields.length > 0
          ? buildPayloadFromFields(deliveryFields, fieldValues, (field) => Boolean(field.sensitive))
          : parseJsonObject(data.credentials, '敏感凭证');

      await apiRequest(`POST:/resource-requests/${request.id}/complete`, {
        instanceName: data.instanceName || request.title,
        expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : undefined,
        createInstance: data.createInstance,
        config,
        delivery,
        credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
      });
      onSuccess();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : '交付失败，请检查表单内容' });
    }
  });

  return {
    deliveryFields,
    error: (formState.errors.root as { message?: string } | undefined)?.message || '',
    fieldValues,
    formData,
    handleSubmit: submit,
    register,
    saving: formState.isSubmitting,
    updateFieldValue,
    updateFormData,
  };
}
