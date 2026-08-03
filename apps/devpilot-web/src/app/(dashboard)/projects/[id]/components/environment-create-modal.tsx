/**
 * 新建环境弹窗
 *
 * 单一职责:采集 key/name/description/sortOrder,提交 POST:/project-environments。
 *   沿用后端 writeAccessPolicy.assertCanCreate 审批。
 */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Modal } from '@/components/ui';
import { useEnvironmentCopySync } from '../hooks/use-environment-copy-sync';

interface CreateForm {
  key: string;
  name: string;
  description: string;
  sortOrder: string;
}

const EMPTY: CreateForm = { key: '', name: '', description: '', sortOrder: '' };

export function EnvironmentCreateModal({
  open,
  projectId,
  onClose,
  onChanged,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations('projects');
  const hook = useEnvironmentCopySync({ onChanged });
  const [form, setForm] = useState<CreateForm>(EMPTY);

  useEffect(() => {
    if (open) setForm(EMPTY);
  }, [open]);

  const patch = (p: Partial<CreateForm>) => setForm((prev) => ({ ...prev, ...p }));

  const submit = async () => {
    const created = await hook.createEnvironment(projectId, {
      key: form.key.trim(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      sortOrder: form.sortOrder ? Number(form.sortOrder) : undefined,
    });
    if (created) onClose();
  };

  const inputCls = 'w-full rounded-md border px-3 py-2';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('envCreateTitle')}
      width={420}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={hook.creating}
          >
            {t('envCancel')}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={hook.creating}
            disabled={!form.key.trim() || !form.name.trim()}
          >
            {t('envCreateAction')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('envCreateKey')}</span>
          <input
            value={form.key}
            onChange={(e) => patch({ key: e.target.value })}
            className={inputCls}
            placeholder="production"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('envCreateName')}</span>
          <input
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('envCreateDescription')}</span>
          <input
            value={form.description}
            onChange={(e) => patch({ description: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('envCreateSortOrder')}</span>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => patch({ sortOrder: e.target.value })}
            className={inputCls}
          />
        </label>
      </div>
    </Modal>
  );
}
