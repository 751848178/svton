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
import { Button, ErrorBanner, Input, Modal } from '@/components/ui';

interface SavePresetModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

interface SavePresetFormData {
  name: string;
}

export function SavePresetModal({ open, onClose, onSave }: SavePresetModalProps) {
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
    <Modal open={open} onClose={handleClose} title={t('savePreset')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <ErrorBanner message={saveError} variant="inline" />
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('presetName')}</span>
          <Input type="text" {...register('name')} placeholder={t('presetNamePlaceholder')} />
        </label>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            {tc('cancel')}
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={!name}>
            {isSubmitting ? t('saving') : tc('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
