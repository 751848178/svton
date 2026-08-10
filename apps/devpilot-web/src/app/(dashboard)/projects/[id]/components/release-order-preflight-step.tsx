'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { ReleaseOrderDetail } from '../types/release-order.types';
import { ReleaseGateCatalogPanel } from './release-gate-catalog-panel';

export function ReleaseOrderPreflightStep({ detail }: { detail: ReleaseOrderDetail }) {
  const t = useTranslations('projects');
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{t('releaseStepPreflightTitle')}</h3>
      <p className="text-sm text-muted-foreground">{t('releaseStepPreflightDescription')}</p>
      <ReleaseGateCatalogPanel
        projectId={detail.projectId}
        releaseOrderId={detail.id}
      />
    </div>
  );
}
