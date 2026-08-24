'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Select } from '@/components/ui';
import type { SettingsObservabilityDraft } from './settings-env.model';
import { SubtabShell } from './settings-subtab-shell';

export function EnvVerificationTab(props: {
  value: SettingsObservabilityDraft['profile'];
  onChange: (next: SettingsObservabilityDraft['profile']) => void;
  /** 当前环境中文名（SET-18：文案不再硬编码 Production）。 */
  environmentLabel: string;
}) {
  const t = useTranslations('projects');
  return (
    <SubtabShell
      title={t('envTabVerification')}
      helper={t('envTabHelperVerification')}
    >
      <label className="block rounded-md border p-4 text-sm">
        <span className="font-medium">{t('environmentObservabilityTitle')}</span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {t('environmentObservabilityHelper', { environment: props.environmentLabel })}
        </span>
        <Select
          className="mt-3"
          value={props.value}
          onChange={(event) =>
            props.onChange(event.target.value as SettingsObservabilityDraft['profile'])
          }
        >
          <option value="">{t('environmentObservabilityUnconfigured')}</option>
          <option value="local_acceptance_v1">{t('environmentObservabilityLocal')}</option>
        </Select>
        {props.value === 'local_acceptance_v1' ? (
          <span className="mt-2 block text-xs text-amber-800">
            {t('environmentObservabilityAcceptanceOnly', {
              environment: props.environmentLabel,
            })}
          </span>
        ) : null}
      </label>
    </SubtabShell>
  );
}
