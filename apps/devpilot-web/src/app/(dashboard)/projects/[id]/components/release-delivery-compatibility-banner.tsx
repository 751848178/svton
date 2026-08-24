'use client';

import { useTranslations } from 'next-intl';
import { useReleaseDeliveryCompatibility } from '../hooks/use-release-delivery-compatibility';

export function ReleaseDeliveryCompatibilityDetails({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');
  const { compatibility, error } = useReleaseDeliveryCompatibility(projectId);
  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!compatibility) return null;
  const history = compatibility.history;
  const retainedLogs = history.logStreams + history.logEntries;
  return (
    <details className="rounded-md border text-xs text-muted-foreground">
      <summary className="min-h-11 cursor-pointer px-4 py-3 font-medium text-foreground">
        {t('deliveryCompatibilityTitle')}
      </summary>
      <div className="space-y-2 border-t px-4 py-3">
        <p>
          {t('deliveryCompatibilitySummary', {
            runs: history.deploymentRuns.length,
            logs: retainedLogs,
            unverified: compatibility.report.summary.unverified,
          })}
        </p>
        <p>{t('deliveryCompatibilityEvidenceMode')}</p>
      </div>
    </details>
  );
}
