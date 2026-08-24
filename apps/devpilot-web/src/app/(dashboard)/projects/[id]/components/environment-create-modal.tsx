/**
 * 新建环境弹窗
 *
 * 单一职责:采集 key/name/description/sortOrder,提交 POST:/project-environments。
 *   沿用后端 writeAccessPolicy.assertCanCreate 审批。
 */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Field, Input, Modal } from '@/components/ui';
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
        <Field label={t('envCreateKey')}>
          <Input
            value={form.key}
            onChange={(e) => patch({ key: e.target.value })}
            placeholder="production"
          />
        </Field>
        <Field label={t('envCreateName')}>
          <Input
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Field>
        <Field label={t('envCreateDescription')}>
          <Input
            value={form.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </Field>
        <Field label={t('envCreateSortOrder')}>
          <Input
            type="number"
            value={form.sortOrder}
            onChange={(e) => patch({ sortOrder: e.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}
