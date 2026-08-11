'use client';

import { useTranslations } from 'next-intl';

export function ReleaseProductionLegacyRecoveryAlert() {
  const t = useTranslations('projects');
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4" role="alert">
      <p className="font-medium">{t('releaseProductionLegacyRecoveryTitle')}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('releaseProductionLegacyRecoveryDescription')}
      </p>
    </div>
  );
}
