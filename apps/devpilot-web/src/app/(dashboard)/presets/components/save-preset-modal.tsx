/**
 * 保存预设弹窗
 *
 * 单一职责：收集预设名称并提交保存。
 * react-hook-form 样板：取代手写 useState + 受控 onChange。
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Modal, ErrorBanner } from '@/components/ui';

interface SavePresetModalProps {
  open: boolean;
  config: unknown;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

interface SavePresetFormData {
  name: string;
}

export function SavePresetModal({ open, config, onClose, onSave }: SavePresetModalProps) {
  const t = useTranslations('presets');
  const tc = useTranslations('common');
  const { register, handleSubmit, watch, reset, formState } = useForm<SavePresetFormData>({
    defaultValues: { name: '' },
  });
  const name = watch('name');
  const isSubmitting = formState.isSubmitting;
  const [saveError, setSaveError] = useState('');

  const handleClose = () => {
    setSaveError('');
    onClose();
  };

  const onSubmit = async (data: SavePresetFormData) => {
    setSaveError('');
    try {
      await onSave(data.name);
      handleClose();
      reset({ name: '' });
    } catch (error) {
      console.error('Failed to save preset:', error);
      setSaveError(error instanceof Error ? error.message : t('saveFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('savePreset')}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <ErrorBanner
          message={saveError}
          variant="inline"
        />
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('presetName')}</span>
          <input
            type="text"
            {...register('name')}
            required
            className="w-full rounded-md border bg-background px-3 py-2"
            placeholder={t('presetNamePlaceholder')}
          />
        </label>
        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border px-4 py-2 transition-colors hover:bg-accent"
          >
            {tc('cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? t('saving') : tc('save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
