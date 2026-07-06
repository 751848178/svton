/**
 * 创建资源申请表单状态（react-hook-form）。
 *
 * 取代原多个 useState + 手写 setFormData/fieldValues 的手搓表单状态。
 * 主表单字段（resourceTypeId/projectId/title/environment/purpose/spec）走 react-hook-form；
 * 动态资源字段（key 来自所选 resourceType，运行时变化）用一个受控 map 维护，
 * 因为 react-hook-form 的 register 难以处理运行时才知道 key 的字段集合。
 *
 * 对外暴露与旧 hook 兼容的 shape，使 CreateRequestModal / CreateRequestFormFields 改动最小。
 */
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { apiRequest } from '@/lib/api-client';
import type { ResourceFieldValue, ResourceType } from '../types';
import { buildInitialFieldValues, buildSpecFromFields, getResourceFields } from '../utils';

export interface CreateRequestFormData {
  resourceTypeId: string;
  projectId: string;
  title: string;
  environment: string;
  purpose: string;
  spec: string;
}

interface UseCreateRequestFormOptions {
  resourceTypes: ResourceType[];
  onSuccess: () => void;
}

export function useCreateRequestForm({ resourceTypes, onSuccess }: UseCreateRequestFormOptions) {
  const { register, handleSubmit, watch, setValue, setError, formState } = useForm<CreateRequestFormData>({
    defaultValues: {
      resourceTypeId: resourceTypes[0]?.id || '',
      projectId: '',
      title: '',
      environment: 'dev',
      purpose: '',
      spec: '{}',
    },
  });

  // 动态字段：key 随所选 resourceType 变化，无法静态 register；用单一受控 map 管理。
  const [fieldValues, setFieldValues] = useState<Record<string, ResourceFieldValue>>(() =>
    buildInitialFieldValues(resourceTypes[0]),
  );

  const resourceTypeId = watch('resourceTypeId');
  const selectedResourceType = useMemo(
    () => resourceTypes.find((type) => type.id === resourceTypeId),
    [resourceTypeId, resourceTypes],
  );
  const fields = useMemo(() => getResourceFields(selectedResourceType), [selectedResourceType]);
  const hasEnvironmentField = fields.some((field) => field.key === 'environment');

  // resourceType 切换时重置动态字段默认值
  useEffect(() => {
    const initialValues = buildInitialFieldValues(selectedResourceType);
    setFieldValues(initialValues);
    if (typeof initialValues.environment === 'string' && initialValues.environment) {
      setValue('environment', initialValues.environment);
    }
  }, [selectedResourceType, setValue]);

  const formData = watch();

  const updateFormData = (patch: Partial<CreateRequestFormData>) => {
    (Object.keys(patch) as (keyof CreateRequestFormData)[]).forEach((key) => {
      setValue(key, patch[key] as never);
    });
  };

  const updateFieldValue = (key: string, value: ResourceFieldValue) => {
    setFieldValues((current) => ({ ...current, [key]: value }));
    if (key === 'environment' && typeof value === 'string') {
      setValue('environment', value);
    }
  };

  const submit = handleSubmit(async (data) => {
    try {
      const spec =
        fields.length > 0
          ? buildSpecFromFields(fields, fieldValues)
          : JSON.parse(data.spec || '{}');
      await apiRequest('POST:/resource-requests', {
        resourceTypeId: data.resourceTypeId,
        projectId: data.projectId || undefined,
        title: data.title,
        environment: data.environment || undefined,
        purpose: data.purpose || undefined,
        spec,
      });
      onSuccess();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : '创建申请失败，请检查 JSON 格式' });
    }
  });

  return {
    error: (formState.errors.root as { message?: string } | undefined)?.message || '',
    fields,
    fieldValues,
    formData,
    handleSubmit: submit,
    hasEnvironmentField,
    register,
    saving: formState.isSubmitting,
    updateFieldValue,
    updateFormData,
  };
}
