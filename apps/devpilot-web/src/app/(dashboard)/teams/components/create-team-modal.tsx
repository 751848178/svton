/**
 * 创建团队弹窗
 *
 * 单一职责：收集团队名称与描述并提交创建。
 * react-hook-form 样板：取代手写 useState + 受控 onChange。
 */

'use client';

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui';

interface CreateTeamModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string) => Promise<void>;
}

interface CreateTeamFormData {
  name: string;
  description: string;
}

export function CreateTeamModal({ open, onClose, onCreate }: CreateTeamModalProps) {
  const t = useTranslations('teams');
  const tc = useTranslations('common');
  const { register, handleSubmit, watch, reset, formState } = useForm<CreateTeamFormData>({
    defaultValues: { name: '', description: '' },
  });
  const name = watch('name');
  const creating = formState.isSubmitting;

  const onSubmit = async (data: CreateTeamFormData) => {
    if (!data.name.trim()) return;
    await onCreate(data.name.trim(), data.description.trim() || undefined);
    reset({ name: '', description: '' });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('createNewTeam')}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            {t('teamName')} <span className="text-destructive">*</span>
          </span>
          <input
            type="text"
            {...register('name')}
            placeholder={t('teamNamePlaceholder')}
            className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{tc('description')}</span>
          <textarea
            {...register('description')}
            placeholder={t('teamDescriptionPlaceholder')}
            rows={3}
            className="w-full resize-none rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {tc('cancel')}
          </button>
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? t('creating') : tc('create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
