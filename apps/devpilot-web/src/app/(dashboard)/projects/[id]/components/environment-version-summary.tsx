'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { EnvironmentVersionItem } from '../types/environment-version.types';
import { environmentVersionKindLabelKey } from '../utils/release-copy.model';

export function EnvironmentVersionSummary({ version }: { version: EnvironmentVersionItem }) {
  const t = useTranslations('projects');
  return (
    <div className="min-w-0">
      <p className="font-medium">
        {t('environmentVersionSummary', {
          version: version.releaseOrder.releaseVersion,
          kind: t(environmentVersionKindLabelKey(version.kind)),
        })}
      </p>
      <p className="break-all font-mono text-muted-foreground">
        {t('environmentVersionBuildRun', {
          revision: version.artifactManifest.buildRun.revision,
          digest: version.artifactManifest.digest,
        })}
      </p>
    </div>
  );
}
