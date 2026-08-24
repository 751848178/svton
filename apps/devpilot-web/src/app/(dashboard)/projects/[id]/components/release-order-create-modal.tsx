'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input, Modal, Textarea } from '@/components/ui';
import type { ReleaseOrdersHook } from '../hooks/use-release-orders';
import { buildReleaseOrderInput } from '../utils/release-order.utils';
import {
  isCanonicalReleaseVersion,
  RELEASE_VERSION_INPUT_PATTERN,
} from '../utils/release-version-display.model';

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
  const [releaseName, setReleaseName] = useState('');
  const [releaseVersion, setReleaseVersion] = useState('');
  const [note, setNote] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = await orders.create(buildReleaseOrderInput(releaseName, releaseVersion, note));
    if (!created) return;
    setReleaseName('');
    setReleaseVersion('');
    setNote('');
    onClose();
  };

  // 取消视为放弃本次输入：清空暂存，避免重开时残留上次的草稿（WIZ-5）。
  const closeAndReset = () => {
    setReleaseName('');
    setReleaseVersion('');
    setNote('');
    onClose();
  };

  const nameEmpty = !releaseName.trim();
  const versionEmpty = !releaseVersion.trim();
  const versionInvalid = !versionEmpty && !isCanonicalReleaseVersion(releaseVersion);
  const disabledReason = nameEmpty
    ? t('releaseNameRequiredHint')
    : versionEmpty
      ? t('releaseVersionRequiredHint')
      : versionInvalid
        ? t('releaseVersionFormatHint')
        : '';

  return (
    <Modal
      open={open}
      onClose={closeAndReset}
      title={t('createReleaseOrder')}
      ariaCloseLabel={tc('close')}
      ariaDescriptionId="release-order-create-description"
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="space-y-4"
      >
        <p
          id="release-order-create-description"
          className="text-sm text-muted-foreground"
        >
          {t('createReleaseOrderDescription')}
        </p>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('releaseNameLabel')}</span>
          <Input
            value={releaseName}
            onChange={(event) => setReleaseName(event.target.value)}
            placeholder={t('releaseNamePlaceholder')}
            maxLength={100}
            required
            autoFocus
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('releaseVersionLabel')}</span>
          <Input
            value={releaseVersion}
            onChange={(event) => setReleaseVersion(event.target.value)}
            placeholder="2.4.1"
            maxLength={100}
            pattern={RELEASE_VERSION_INPUT_PATTERN}
            title={t('releaseVersionFormatHint')}
            aria-invalid={versionInvalid || undefined}
          />
          {versionInvalid ? (
            <span
              role="alert"
              className="mt-1 block text-sm text-destructive"
            >
              {t('releaseVersionFormatHint')}
            </span>
          ) : null}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('releaseNoteLabel')}</span>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={2000}
          />
        </label>
        {orders.createError ? (
          <p
            role="alert"
            className="text-sm text-destructive"
            data-testid="release-order-create-error"
          >
            {t('createReleaseOrderError')}: {orders.createError}
          </p>
        ) : null}
        <div className="flex flex-col items-end gap-1 pt-2">
          <div className="flex justify-end gap-2">
            <Button
              className="min-h-11"
              type="button"
              variant="secondary"
              onClick={closeAndReset}
              disabled={orders.creating}
            >
              {tc('cancel')}
            </Button>
            <Button
              className="min-h-11"
              type="submit"
              loading={orders.creating}
              disabled={nameEmpty || versionEmpty || versionInvalid}
            >
              {t('createReleaseOrder')}
            </Button>
          </div>
          {disabledReason ? (
            <p className="text-xs text-muted-foreground">{disabledReason}</p>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
