'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Button, ErrorBanner, Input, Textarea } from '@/components/ui';
import { useProjectConfigStore } from '@/store/hooks';
import { validatePackageNameKey } from './package-name';

interface StepProps {
  onNext: () => void;
  onPrev: () => void;
}

export function StepBasicInfo({ onNext }: StepProps) {
  const t = useTranslations('projectWizard');
  const { config, setBasicInfo } = useProjectConfigStore();
  const [nameError, setNameError] = useState<string>();

  const handleNameChange = usePersistFn((name: string) => {
    setBasicInfo({ name });
    const errorKey = validatePackageNameKey(name);
    setNameError(errorKey ? t(errorKey) : undefined);
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
        <Input
          type="text"
          value={config.basicInfo.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="my-awesome-project"
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
        <Input
          type="text"
          value={config.basicInfo.orgName}
          onChange={(e) => handleOrgChange(e.target.value)}
          placeholder={config.basicInfo.name || 'my-org'}
        />
        <p className="mt-1 text-sm text-muted-foreground">{t('orgNameHint')}</p>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">{t('projectDescription')}</label>
        <Textarea
          value={config.basicInfo.description}
          onChange={(e) => setBasicInfo({ description: e.target.value })}
          placeholder={t('projectDescriptionPlaceholder')}
          rows={3}
          className="resize-none"
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
        <Button
          onClick={handleNext}
          disabled={!config.basicInfo.name || !!nameError}
        >
          {t('next')}
        </Button>
      </div>
    </div>
  );
}
