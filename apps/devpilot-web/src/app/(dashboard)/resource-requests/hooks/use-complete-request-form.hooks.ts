import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
  const [fieldValues, setFieldValues] = useState<Record<string, ResourceFieldValue>>(() =>
    buildInitialValuesFromFields(deliveryFields),
  );
  const [formData, setFormData] = useState<CompleteRequestFormData>({
    instanceName: request.title,
    expiresAt: '',
    createInstance: true,
    config: '{}',
    delivery: '{}',
    credentials: '{}',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFieldValues(buildInitialValuesFromFields(deliveryFields));
  }, [deliveryFields]);

  const updateFormData = (patch: Partial<CompleteRequestFormData>) => {
    setFormData((current) => ({ ...current, ...patch }));
  };

  const updateFieldValue = (key: string, value: ResourceFieldValue) => {
    setFieldValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      const config = parseJsonObject(formData.config, '实例配置');
      const delivery =
        deliveryFields.length > 0
          ? buildPayloadFromFields(deliveryFields, fieldValues, (field) => !field.sensitive)
          : parseJsonObject(formData.delivery, '交付信息');
      const credentials =
        deliveryFields.length > 0
          ? buildPayloadFromFields(deliveryFields, fieldValues, (field) => Boolean(field.sensitive))
          : parseJsonObject(formData.credentials, '敏感凭证');

      await apiRequest(`POST:/resource-requests/${request.id}/complete`, {
        instanceName: formData.instanceName || request.title,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined,
        createInstance: formData.createInstance,
        config,
        delivery,
        credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '交付失败，请检查表单内容');
    } finally {
      setSaving(false);
    }
  };

  return {
    deliveryFields,
    error,
    fieldValues,
    formData,
    handleSubmit,
    saving,
    updateFieldValue,
    updateFormData,
  };
}
