'use client';

import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type { ReleaseOrderDetail } from '../types/release-order.types';
import { ReleaseGateCatalogPanel } from './release-gate-catalog-panel';

export function ReleaseOrderPreflightStep({ detail }: { detail: ReleaseOrderDetail }) {
  const t = useTranslations('projects');
  const checks = [
    {
      key: 'repository',
      label: t('releasePreflightRepository'),
      ready: detail.preflight.repository.ready,
      description: detail.preflight.repository.branch || t('releasePreflightBranchMissing'),
    },
    {
      key: 'staging',
      label: t('releasePreflightStaging'),
      ready: detail.preflight.staging.ready,
      description: t('releasePreflightBaselineDescription'),
    },
    {
      key: 'production',
      label: t('releasePreflightProduction'),
      ready: detail.preflight.production.ready,
      description: t('releasePreflightBaselineDescription'),
    },
  ];
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">{t('releaseStepPreflightTitle')}</h3>
      <p className="text-sm text-muted-foreground">{t('releaseStepPreflightDescription')}</p>
      {checks.map((check) => (
        <div key={check.key} className="flex items-center justify-between gap-3 rounded-md border p-4">
          <div>
            <p className="font-medium">{check.label}</p>
            <p className="text-sm text-muted-foreground">{check.description}</p>
          </div>
          <StatusTag
            status={check.ready ? 'success' : 'error'}
            label={check.ready ? t('releasePreflightReady') : t('releasePreflightBlocked')}
          />
        </div>
      ))}
      <ReleaseGateCatalogPanel projectId={detail.projectId} releaseOrderId={detail.id} />
    </div>
  );
}
