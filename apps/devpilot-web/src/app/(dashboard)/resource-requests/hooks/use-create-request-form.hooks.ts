import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
  const [formData, setFormData] = useState<CreateRequestFormData>({
    resourceTypeId: resourceTypes[0]?.id || '',
    projectId: '',
    title: '',
    environment: 'dev',
    purpose: '',
    spec: '{}',
  });
  const [fieldValues, setFieldValues] = useState<Record<string, ResourceFieldValue>>(() =>
    buildInitialFieldValues(resourceTypes[0]),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedResourceType = useMemo(
    () => resourceTypes.find((type) => type.id === formData.resourceTypeId),
    [formData.resourceTypeId, resourceTypes],
  );
  const fields = useMemo(() => getResourceFields(selectedResourceType), [selectedResourceType]);
  const hasEnvironmentField = fields.some((field) => field.key === 'environment');

  useEffect(() => {
    const initialValues = buildInitialFieldValues(selectedResourceType);
    setFieldValues(initialValues);
    if (typeof initialValues.environment === 'string' && initialValues.environment) {
      setFormData((current) => ({
        ...current,
        environment: initialValues.environment as string,
      }));
    }
  }, [selectedResourceType]);

  const updateFormData = (patch: Partial<CreateRequestFormData>) => {
    setFormData((current) => ({ ...current, ...patch }));
  };

  const updateFieldValue = (key: string, value: ResourceFieldValue) => {
    setFieldValues((current) => ({ ...current, [key]: value }));
    if (key === 'environment' && typeof value === 'string') {
      updateFormData({ environment: value });
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const spec =
        fields.length > 0
          ? buildSpecFromFields(fields, fieldValues)
          : JSON.parse(formData.spec || '{}');
      await apiRequest('POST:/resource-requests', {
        resourceTypeId: formData.resourceTypeId,
        projectId: formData.projectId || undefined,
        title: formData.title,
        environment: formData.environment || undefined,
        purpose: formData.purpose || undefined,
        spec,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建申请失败，请检查 JSON 格式');
    } finally {
      setSaving(false);
    }
  };

  return {
    error,
    fields,
    fieldValues,
    formData,
    handleSubmit,
    hasEnvironmentField,
    saving,
    updateFieldValue,
    updateFormData,
  };
}
