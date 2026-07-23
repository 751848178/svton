/**
 * 添加成员弹窗
 *
 * 单一职责：收集成员邮箱与角色并提交。
 * react-hook-form 样板：取代手写 useState + 受控 onChange。
 */

'use client';

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Button, Input, Modal, Select } from '@/components/ui';
import type { MemberRole } from '@/store/hooks';

interface AddMemberModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (email: string, role: MemberRole) => Promise<void>;
}

interface AddMemberFormData {
  email: string;
  role: MemberRole;
}

export function AddMemberModal({ open, onClose, onAdd }: AddMemberModalProps) {
  const t = useTranslations('teams');
  const tc = useTranslations('common');
  const { register, handleSubmit, watch, reset, formState } = useForm<AddMemberFormData>({
    defaultValues: { email: '', role: 'member' },
  });
  const email = watch('email');
  const adding = formState.isSubmitting;

  const onSubmit = async (data: AddMemberFormData) => {
    if (!data.email.trim()) return;
    await onAdd(data.email.trim(), data.role);
    reset({ email: '', role: 'member' });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('addMember')}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            {t('memberEmail')} <span className="text-destructive">*</span>
          </span>
          <Input
            type="email"
            {...register('email')}
            placeholder={t('memberEmailPlaceholder')}
            autoFocus
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('role')}</span>
          <Select {...register('role')}>
            <option value="member">{t('member')}</option>
            <option value="admin">{t('admin')}</option>
          </Select>
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            {tc('cancel')}
          </Button>
          <Button
            type="submit"
            disabled={adding || !email.trim()}
          >
            {adding ? t('adding') : tc('add')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
