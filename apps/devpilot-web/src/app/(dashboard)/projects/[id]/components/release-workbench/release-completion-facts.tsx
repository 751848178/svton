'use client';

import { useTranslations } from 'next-intl';
import { shortDigest, shortTechnicalId } from '../../utils/release-display.utils';
import { formatIso } from '../../utils/release-time.utils';
import type { ReleaseCompletionRecord } from './release-completion-record.model';

export function ReleaseCompletionFacts({ record }: { record: ReleaseCompletionRecord }) {
  const t = useTranslations('projects');
  const facts = [
    [t('releaseCompletionVersion'), record.releaseVersion],
    [t('releaseCompletionEnvironment'), record.releaseRun.environment.name],
    [t('releaseCompletionEnvironmentVersion'), shortTechnicalId(record.environmentVersion.id)],
    [t('releaseCompletionManifestId'), shortTechnicalId(record.releaseRun.artifactManifestId)],
    [t('releaseLifecycleOutcome.manifest'), shortDigest(record.releaseRun.manifest.digest)],
    [t('releaseCompletionReleaseRun'), shortTechnicalId(record.releaseRun.id)],
    [t('releaseCompletionReleaseFinishedAt'), formatIso(record.releaseRun.finishedAt)],
    [t('releaseCompletionDeploymentRun'), shortTechnicalId(record.deploymentRun.id)],
    [t('releaseCompletionDeploymentFinishedAt'), formatIso(record.deploymentRun.finishedAt)],
    [t('releaseCompletionEffectiveAt'), formatIso(record.environmentVersion.effectiveAt)],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-4 rounded-lg border p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {facts.map(([label, value], index) => (
        <div
          key={`${label}-${index}`}
          className="min-w-0"
        >
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd
            className="mt-1 break-all"
            title={value}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
