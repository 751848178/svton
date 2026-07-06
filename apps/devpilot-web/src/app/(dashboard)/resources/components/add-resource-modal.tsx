/**
 * 添加资源弹窗
 *
 * 单一职责：根据所选资源类型动态渲染字段表单并提交。
 * 使用 @svton/ui Modal。
 *
 * react-hook-form 样板：静态字段（type/name）走 useForm；
 * 动态资源属性字段（key 来自所选 resourceType，运行时变化）用一个受控 map 维护，
 * 因为 react-hook-form 的 register 难以处理运行时才知道 key 的字段集合。
 */

'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useSetState } from '@svton/hooks';
import { Modal } from '@/components/ui';
import type { ResourceType, ResourceInput } from '../types';

interface AddResourceModalProps {
  open: boolean;
  resourceTypes: ResourceType[];
  onClose: () => void;
  onCreate: (input: ResourceInput) => Promise<void>;
}

interface AddResourceFormData {
  type: string;
  name: string;
}

export function AddResourceModal({
  open,
  resourceTypes,
  onClose,
  onCreate,
}: AddResourceModalProps) {
  const t = useTranslations('resources');
  const tc = useTranslations('common');
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState,
  } = useForm<AddResourceFormData>({
    defaultValues: {
      type: resourceTypes[0]?.id || '',
      name: '',
    },
  });

  // 动态字段：key 随所选 resourceType 变化，无法静态 register；用单一受控 map 管理。
  const [config, setConfig] = useSetState<Record<string, string>>({});

  const type = watch('type');
  const selectedType = useMemo(
    () => resourceTypes.find((option) => option.id === type),
    [resourceTypes, type],
  );

  useEffect(() => {
    if (!type && resourceTypes[0]) setValue('type', resourceTypes[0].id);
  }, [resourceTypes, type, setValue]);

  const submit = handleSubmit(async (data) => {
    try {
      await onCreate({ type: data.type, name: data.name, config });
      onClose();
      reset({ type: data.type, name: '' });
      setConfig({});
    } catch (error) {
      console.error('Failed to create resource:', error);
      alert(t('createFailed'));
    }
  });

  const handleTypeChange = (value: string) => {
    setValue('type', value);
    setConfig({});
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('addResource')}
    >
      {resourceTypes.length === 0 ? (
        <div className="text-sm text-muted-foreground">{t('noResourceTypes')}</div>
      ) : (
        <form
          onSubmit={submit}
          className="space-y-4"
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('resourceType')}</span>
            <select
              {...register('type')}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2"
            >
              {resourceTypes.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                >
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('resourceName')}</span>
            <input
              type="text"
              {...register('name', { required: true })}
              required
              className="w-full rounded-md border bg-background px-3 py-2"
              placeholder={t('resourceNamePlaceholder')}
            />
          </label>

          {selectedType?.fields.map((field) => (
            <label
              key={field.key}
              className="block text-sm"
            >
              <span className="mb-1 block font-medium">
                {field.label}
                {field.required ? <span className="ml-1 text-destructive">*</span> : null}
              </span>
              <input
                type={field.type}
                value={config[field.key] || ''}
                onChange={(e) => setConfig({ [field.key]: e.target.value })}
                required={field.required}
                placeholder={field.default?.toString()}
                className="w-full rounded-md border bg-background px-3 py-2"
              />
            </label>
          ))}

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 transition-colors hover:bg-accent"
            >
              {tc('cancel')}
            </button>
            <button
              type="submit"
              disabled={formState.isSubmitting || !type}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {formState.isSubmitting ? t('adding') : tc('add')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
