'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input, Modal, Textarea } from '@/components/ui';
import type { ReleaseOrdersHook } from '../hooks/use-release-orders';
import { buildReleaseOrderInput } from '../utils/release-order.utils';

export function ReleaseOrderCreateModal({
  open,
  onClose,
  orders,
}: {
  open: boolean;
  onClose: () => void;
  orders: ReleaseOrdersHook;
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const [releaseVersion, setReleaseVersion] = useState('');
  const [note, setNote] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = await orders.create(buildReleaseOrderInput(releaseVersion, note));
    if (!created) return;
    setReleaseVersion('');
    setNote('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('createReleaseOrder')}
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="space-y-4"
      >
        <p className="text-sm text-muted-foreground">{t('createReleaseOrderDescription')}</p>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('releaseVersionLabel')}</span>
          <Input
            value={releaseVersion}
            onChange={(event) => setReleaseVersion(event.target.value)}
            placeholder="2.4.1"
            maxLength={100}
            autoFocus
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('releaseNoteLabel')}</span>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={2000}
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={orders.creating}
          >
            {tc('cancel')}
          </Button>
          <Button
            type="submit"
            loading={orders.creating}
            disabled={!releaseVersion.trim()}
          >
            {t('createReleaseOrder')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
