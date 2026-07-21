/**
 * 资源池表单弹窗
 *
 * 单一职责：新增/编辑资源池表单。
 */

'use client';

import { usePersistFn } from '@svton/hooks';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui';
import type { PoolForm, ResourcePool } from '../types';
import { POOL_TYPES } from '../constants';

interface PoolFormModalProps {
  open: boolean;
  editingPool: ResourcePool | null;
  form: PoolForm;
  onChange: (patch: Partial<PoolForm>) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function PoolFormModal({
  open,
  editingPool,
  form,
  onChange,
  onClose,
  onSubmit,
}: PoolFormModalProps) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const handleClose = usePersistFn(() => onClose());
  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editingPool ? t('editPool') : t('addPool')}
    >
      <form
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{tc('type')}</span>
          <select
            value={form.type}
            onChange={(e) => onChange({ type: e.target.value })}
            className="w-full rounded-lg border px-3 py-2"
            disabled={Boolean(editingPool)}
          >
            {POOL_TYPES.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{tc('name')}</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full rounded-lg border px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('endpoint')}</span>
          <input
            type="text"
            value={form.endpoint}
            onChange={(e) => onChange({ endpoint: e.target.value })}
            className="w-full rounded-lg border px-3 py-2"
            placeholder={t('endpointPlaceholder')}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('capacity')}</span>
          <input
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => onChange({ capacity: parseInt(e.target.value, 10) })}
            className="w-full rounded-lg border px-3 py-2"
            required
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-muted-foreground hover:bg-accent"
          >
            {tc('cancel')}
          </button>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            {tc('save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
