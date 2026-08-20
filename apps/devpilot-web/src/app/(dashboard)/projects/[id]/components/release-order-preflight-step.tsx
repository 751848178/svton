'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { useReleaseGateCatalog } from '../hooks/use-release-gate-catalog';
import type { ReleaseOrderDetail } from '../types/release-order.types';
import { ReleaseGateCatalogView } from './release-gate-catalog-panel';

export function ReleaseOrderPreflightStep({
  detail,
  gateCatalog,
}: {
  detail: ReleaseOrderDetail;
  gateCatalog: ReturnType<typeof useReleaseGateCatalog>;
}) {
  const t = useTranslations('projects');
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{t('releaseStepPreflightTitle')}</h3>
      <p className="text-sm text-muted-foreground">{t('releaseStepPreflightDescription')}</p>
      <ReleaseGateCatalogView controller={gateCatalog} />
    </div>
  );
}
