'use client';

import React, { useRef, useState } from 'react';
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
import { EnvironmentVersionRecoveryControl } from './environment-version-recovery-control';

export function EnvironmentVersionConfig(props: {
  projectId: string;
  environment: ProjectEnvironment;
}) {
  const t = useTranslations('projects');
  const versions = useEnvironmentVersions(props.projectId);
  const [selectedId, setSelectedId] = useState<string>();
  const [switchCandidate, setSwitchCandidate] = useState<EnvironmentVersionCandidate>();
  const switchRestoreFocusRef = useRef<HTMLButtonElement | null>(null);
  if (versions.loading) return <LoadingState />;
  const environment = versions.environments.find((item) => item.id === props.environment.id);
  if (versions.error && !environment)
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{t('versionConfigurationTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('versionConfigurationDescription')}
          </p>
        </div>
        <EnvironmentVersionRecoveryControl
          projectId={props.projectId}
          environment={environment}
          execute={versions.execute}
          refresh={versions.load}
        />
      </div>
      {versions.error ? (
        <ErrorBanner
          message={versions.error}
          onRetry={versions.load}
        />
      ) : null}
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <EnvironmentVersionList
          environment={environment}
          current={current}
          candidates={candidates}
          selectedId={selected?.id}
          executing={versions.executing}
          onSelect={(candidate) => setSelectedId(candidate.id)}
          onSwitch={(candidate, restoreFocusTarget) => {
            switchRestoreFocusRef.current = restoreFocusTarget ?? null;
            setSwitchCandidate(candidate);
          }}
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
          restoreFocusRef={switchRestoreFocusRef}
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
