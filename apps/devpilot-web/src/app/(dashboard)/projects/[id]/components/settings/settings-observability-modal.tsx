'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Modal, Select } from '@/components/ui';
import type { SettingsObservabilityDraft } from './settings-env.model';

type Profile = SettingsObservabilityDraft['profile'];

export function SettingsObservabilityModal(props: {
  value: Profile;
  environmentLabel: string;
  onChange: (next: Profile) => void;
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Profile>(props.value);
  const begin = () => {
    setDraft(props.value);
    setOpen(true);
  };
  const apply = () => {
    props.onChange(draft);
    setOpen(false);
  };
  return (
    <>
      <Button
        variant="outline"
        className="min-h-11"
        onClick={begin}
      >
        {t('environmentObservabilityEdit')}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('environmentObservabilityEdit')}
        description={t('environmentObservabilityHelper', { environment: props.environmentLabel })}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              {tc('cancel')}
            </Button>
            <Button onClick={apply}>{t('environmentObservabilityApply')}</Button>
          </>
        }
      >
        <label className="block space-y-2 text-sm">
          <span className="font-medium">{t('environmentObservabilityTitle')}</span>
          <Select
            value={draft}
            onChange={(event) => setDraft(event.target.value as Profile)}
          >
            <option value="">{t('environmentObservabilityUnconfigured')}</option>
            <option value="local_acceptance_v1">{t('environmentObservabilityLocal')}</option>
          </Select>
        </label>
        {draft === 'local_acceptance_v1' ? (
          <p className="mt-3 text-xs text-amber-800">
            {t('environmentObservabilityAcceptanceOnly', { environment: props.environmentLabel })}
          </p>
        ) : null}
      </Modal>
    </>
  );
}
