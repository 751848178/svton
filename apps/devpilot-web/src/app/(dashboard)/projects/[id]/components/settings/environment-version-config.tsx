'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { useEnvironmentVersions } from '../../hooks/use-environment-versions';
import type { ProjectEnvironment } from '../../types';
import type { EnvironmentVersionCandidate } from '../../types/environment-version.types';
import { approvedEnvironmentVersionRun } from '../environment-version-card';
import { EnvironmentUpgradeDialog } from '../environment-upgrade-dialog';
import { EnvironmentVersionDetail } from './environment-version-detail';
import { EnvironmentVersionList } from './environment-version-list';

export function EnvironmentVersionConfig(props: {
  projectId: string;
  environment: ProjectEnvironment;
}) {
  const t = useTranslations('projects');
  const versions = useEnvironmentVersions(props.projectId);
  const [selectedId, setSelectedId] = useState<string>();
  const [switchCandidate, setSwitchCandidate] = useState<EnvironmentVersionCandidate>();
  if (versions.loading) return <LoadingState />;
  const environment = versions.environments.find((item) => item.id === props.environment.id);
  if (versions.error)
    return (
      <ErrorBanner
        message={versions.error}
        onRetry={versions.load}
      />
    );
  if (!environment) {
    return <p className="text-sm text-muted-foreground">{t('environmentVersionUnavailable')}</p>;
  }
  const current = environment.environmentVersions.find(
    (item) => item.id === environment.currentEnvironmentVersionId,
  );
  const candidates = versions.candidates[environment.baselineRole] ?? [];
  const selected =
    candidates.find((item) => item.id === selectedId) ??
    candidates.find((item) => item.id === current?.artifactManifestId) ??
    candidates[0];
  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">{t('versionConfigurationTitle')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('versionConfigurationDescription')}</p>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <EnvironmentVersionList
          environment={environment}
          current={current}
          candidates={candidates}
          selectedId={selected?.id}
          executing={versions.executing}
          onSelect={(candidate) => setSelectedId(candidate.id)}
          onSwitch={setSwitchCandidate}
        />
        <EnvironmentVersionDetail
          candidate={selected}
          active={selected?.id === current?.artifactManifestId}
          production={environment.baselineRole === 'production'}
        />
      </div>
      {switchCandidate ? (
        <EnvironmentUpgradeDialog
          environment={environment}
          candidate={switchCandidate}
          onClose={() => setSwitchCandidate(undefined)}
          onConfirm={async () => {
            const result = await versions.execute(environment.id, {
              kind: 'upgrade',
              manifestId: switchCandidate.id,
              releaseRunId:
                environment.baselineRole === 'production'
                  ? approvedEnvironmentVersionRun(switchCandidate)
                  : undefined,
            });
            if (result) setSwitchCandidate(undefined);
            return result;
          }}
        />
      ) : null}
    </section>
  );
}
