'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@svton/ui';

export function RepositoryIdentityMigrationRequiredCard() {
  const t = useTranslations('projects');
  return (
    <Card className="space-y-2 border-amber-500/50">
      <div role="status">
        <h2 className="font-semibold">{t('repositoryIdentityMigrationTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('repositoryIdentityMigrationDescription')}
        </p>
      </div>
    </Card>
  );
}
