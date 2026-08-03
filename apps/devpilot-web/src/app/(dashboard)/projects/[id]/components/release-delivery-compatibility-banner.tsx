'use client';

import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui';
import { useReleaseDeliveryCompatibility } from '../hooks/use-release-delivery-compatibility';

export function ReleaseDeliveryCompatibilityBanner({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');
  const { compatibility, error } = useReleaseDeliveryCompatibility(projectId);
  if (error) return <Alert tone="warning">{error}</Alert>;
  if (!compatibility) return null;
  const history = compatibility.history;
  const retainedLogs = history.logStreams + history.logEntries;
  return (
    <Alert tone="info">
      <p className="font-medium">{t('deliveryCompatibilityTitle')}</p>
      <p className="mt-1">
        {t('deliveryCompatibilitySummary', {
          runs: history.deploymentRuns.length,
          logs: retainedLogs,
          unverified: compatibility.report.summary.unverified,
        })}
      </p>
      <p className="mt-1 font-mono text-xs">
        Manifest-only · checkout=false · pull=false · build=false
      </p>
    </Alert>
  );
}
