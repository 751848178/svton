'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui';
import type { ServiceDeploymentForm } from '../types';

interface Props {
  form: ServiceDeploymentForm;
  onChange: (patch: Partial<ServiceDeploymentForm>) => void;
}

type FieldKey = 'preStartCheckCommand' | 'migrationCommand' | 'initializationCommand';

export function ServiceLifecycleFields({ form, onChange }: Props) {
  const t = useTranslations('applications');
  const fields: Array<{
    key: FieldKey;
    step: number;
    policy: string;
  }> = [
    { key: 'preStartCheckCommand', step: 2, policy: t('lifecycleEveryDeploy') },
    { key: 'migrationCommand', step: 3, policy: t('lifecycleEveryDeploy') },
    {
      key: 'initializationCommand',
      step: 4,
      policy: t('lifecycleOncePerEnvironment'),
    },
  ];

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{t('lifecycleOrderHint')}</p>
      {fields.map(({ key, step, policy }) => (
        <label
          key={key}
          className="block space-y-1"
        >
          <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
            <span>
              {step}. {t(`${key}Label`)}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {policy} · {t('lifecycleFailureBlocks')}
            </span>
          </span>
          <span className="block text-xs text-muted-foreground">{t(`${key}Help`)}</span>
          <Input
            value={form[key]}
            onChange={(event) => onChange({ [key]: event.target.value })}
            placeholder={t(`${key}Placeholder`)}
          />
        </label>
      ))}
    </div>
  );
}
