/**
 * 存储密钥弹窗
 *
 * 单一职责：收集密钥信息并提交存储。
 * react-hook-form 样板：取代手写 useSetState + 受控 onChange。
 */

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui';
import { KEY_TYPES } from '../constants';
import type { KeyInput } from '../types';

interface StoreKeyModalProps {
  open: boolean;
  initial?: Partial<KeyInput>;
  onClose: () => void;
  onStore: (input: KeyInput) => Promise<void>;
}

export function StoreKeyModal({ open, initial, onClose, onStore }: StoreKeyModalProps) {
  const t = useTranslations('keys');
  const tc = useTranslations('common');
  const { register, handleSubmit, reset, formState } = useForm<KeyInput>({
    defaultValues: {
      name: '',
      type: initial?.type || 'jwt_secret',
      value: initial?.value || '',
      description: '',
    },
  });

  const onSubmit = async (data: KeyInput) => {
    await onStore(data);
    onClose();
    reset({ name: '', type: 'jwt_secret', value: '', description: '' });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('storeTitle')}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('storeNameLabel')}</span>
          <input
            type="text"
            {...register('name')}
            className="w-full rounded-lg border px-3 py-2"
            placeholder={t('storeNamePlaceholder')}
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('storeTypeLabel')}</span>
          <select
            {...register('type')}
            className="w-full rounded-lg border px-3 py-2"
          >
            {KEY_TYPES.map((kt) => (
              <option
                key={kt.value}
                value={kt.value}
              >
                {t(kt.labelKey)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('storeValueLabel')}</span>
          <textarea
            {...register('value')}
            className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
            rows={3}
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('storeDescriptionLabel')}</span>
          <input
            type="text"
            {...register('description')}
            className="w-full rounded-lg border px-3 py-2"
            placeholder={t('storeDescriptionPlaceholder')}
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-muted-foreground hover:bg-accent"
          >
            {tc('cancel')}
          </button>
          <button
            type="submit"
            disabled={formState.isSubmitting}
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            {tc('save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
