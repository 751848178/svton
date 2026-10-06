'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Input, Select } from '@/components/ui';

export interface TargetFieldsValue {
  providerKey: string;
  root: string;
  targetRef: string;
  sharedEnvironmentIds: string[];
}

const PROVIDERS = [
  { value: 'ssh-v1', labelKey: 'envTargetProviderSshV1' },
  { value: 'local-filesystem-v1', labelKey: 'envTargetProviderLocalFilesystemV1' },
] as const;

export function SettingsEnvTargetFields(props: {
  value: TargetFieldsValue;
  onChange: (value: TargetFieldsValue) => void;
}) {
  const t = useTranslations('projects');
  const set = (patch: Partial<TargetFieldsValue>) => props.onChange({ ...props.value, ...patch });
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('envTargetProviderLabel')}</span>
        <Select
          value={props.value.providerKey}
          onChange={(event) => set({ providerKey: event.target.value })}
          placeholder={t('envTargetProviderPlaceholder')}
          options={PROVIDERS.map((item) => ({ value: item.value, label: t(item.labelKey) }))}
        />
      </label>
      {props.value.providerKey === 'ssh-v1' ? (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('envTargetRootLabel')}</span>
          <Input
            value={props.value.root}
            onChange={(event) => set({ root: event.target.value })}
            placeholder="/srv/app"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {t('envTargetRootHint')}
          </span>
        </label>
      ) : (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('envTargetRefLabel')}</span>
          <Input
            value={props.value.targetRef}
            onChange={(event) => set({ targetRef: event.target.value })}
            placeholder="release-target://…"
          />
        </label>
      )}
    </div>
  );
}
