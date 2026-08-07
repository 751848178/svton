'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { EnvironmentVersionItem } from '../types/environment-version.types';
import { formatIso } from '../utils/release-time.utils';

export function EnvironmentVersionSummary({ version }: { version: EnvironmentVersionItem }) {
  const t = useTranslations('projects');
  const deployedAt = version.deploymentRun.finishedAt ?? version.deploymentRun.createdAt;
  return (
    <dl className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
      <div className="min-w-0">
        <dt className="text-muted-foreground">{t('environmentVersionDeployedVersion')}</dt>
        <dd className="font-medium">
          {t('environmentVersionCurrentValue', {
            version: version.releaseOrder.releaseVersion,
          })}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-muted-foreground">{t('environmentVersionSourceReleaseOrder')}</dt>
        <dd className="break-all font-mono">
          {version.releaseOrder.id} · {version.releaseOrder.releaseVersion}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-muted-foreground">{t('environmentVersionArtifactManifest')}</dt>
        <dd className="break-all font-mono">{version.artifactManifest.id}</dd>
        <dd className="break-all font-mono text-muted-foreground">
          {t('environmentVersionBuildRun', {
            revision: version.artifactManifest.buildRun.revision,
            digest: version.artifactManifest.digest,
          })}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-muted-foreground">{t('environmentVersionLatestDeployedAt')}</dt>
        <dd>{formatIso(deployedAt)}</dd>
      </div>
    </dl>
  );
}
