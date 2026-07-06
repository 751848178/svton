/**
 * 添加成员弹窗
 *
 * 单一职责：收集成员邮箱与角色并提交。
 * react-hook-form 样板：取代手写 useState + 受控 onChange。
 */

'use client';

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui';
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
          <input
            type="email"
            {...register('email')}
            placeholder={t('memberEmailPlaceholder')}
            className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('role')}</span>
          <select
            {...register('role')}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="member">{t('member')}</option>
            <option value="admin">{t('admin')}</option>
          </select>
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {tc('cancel')}
          </button>
          <button
            type="submit"
            disabled={adding || !email.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {adding ? t('adding') : tc('add')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
