'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { ErrorBanner } from '@/components/ui';
import { useProjectConfigStore } from '@/store/hooks';

interface StepProps {
  onNext: () => void;
  onPrev: () => void;
}

export function StepBasicInfo({ onNext }: StepProps) {
  const t = useTranslations('projectWizard');
  const { config, setBasicInfo } = useProjectConfigStore();
  const [nameError, setNameError] = useState<string>();

  const validatePackageName = usePersistFn((name: string): { valid: boolean; error?: string } => {
    if (!name) return { valid: false, error: t('errNameEmpty') };
    if (name.length > 214) return { valid: false, error: t('errNameTooLong') };
    if (name.startsWith('.') || name.startsWith('_'))
      return { valid: false, error: t('errNameStartChar') };
    if (name !== name.toLowerCase()) return { valid: false, error: t('errNameLowercase') };
    if (/[~'!()*]/.test(name)) return { valid: false, error: t('errNameInvalidChar') };
    if (!/^[a-z0-9]/.test(name)) return { valid: false, error: t('errNameAlphaNumStart') };
    if (!/^[a-z0-9-_.]+$/.test(name)) return { valid: false, error: t('errNameAllowedChars') };
    return { valid: true };
  });

  const handleNameChange = usePersistFn((name: string) => {
    setBasicInfo({ name });
    setNameError(validatePackageName(name).error);
  });
  const handleOrgChange = usePersistFn((orgName: string) => {
    setBasicInfo({ orgName: orgName || config.basicInfo.name });
  });
  const handleNext = usePersistFn(() => onNext());

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium">
          {t('projectName')} <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={config.basicInfo.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="my-awesome-project"
          className="w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {nameError ? (
          <ErrorBanner
            message={nameError}
            variant="inline"
          />
        ) : null}
        <p className="mt-1 text-sm text-muted-foreground">{t('projectNameHint')}</p>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">{t('orgName')}</label>
        <input
          type="text"
          value={config.basicInfo.orgName}
          onChange={(e) => handleOrgChange(e.target.value)}
          placeholder={config.basicInfo.name || 'my-org'}
          className="w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="mt-1 text-sm text-muted-foreground">{t('orgNameHint')}</p>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">{t('projectDescription')}</label>
        <textarea
          value={config.basicInfo.description}
          onChange={(e) => setBasicInfo({ description: e.target.value })}
          placeholder={t('projectDescriptionPlaceholder')}
          rows={3}
          className="w-full resize-none rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">{t('packageManager')}</label>
        <div className="flex gap-4">
          {(['pnpm', 'npm', 'yarn'] as const).map((pm) => (
            <label
              key={pm}
              className="flex cursor-pointer items-center gap-2"
            >
              <input
                type="radio"
                name="packageManager"
                value={pm}
                checked={config.basicInfo.packageManager === pm}
                onChange={() => setBasicInfo({ packageManager: pm })}
                className="h-4 w-4 text-primary"
              />
              <span className="text-sm">{pm}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end pt-4">
        <button
          onClick={handleNext}
          disabled={!config.basicInfo.name || !!nameError}
          className="rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('next')}
        </button>
      </div>
    </div>
  );
}
