/**
 * 创建团队弹窗
 *
 * 单一职责：收集团队名称与描述并提交创建。
 * react-hook-form 样板：取代手写 useState + 受控 onChange。
 */

'use client';

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Button, Input, Modal, Textarea } from '@/components/ui';

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
          <Input
            {...register('name')}
            placeholder={t('teamNamePlaceholder')}
            autoFocus
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{tc('description')}</span>
          <Textarea
            {...register('description')}
            placeholder={t('teamDescriptionPlaceholder')}
            rows={3}
            className="resize-none"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            {tc('cancel')}
          </Button>
          <Button
            type="submit"
            disabled={creating || !name.trim()}
          >
            {creating ? t('creating') : tc('create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
