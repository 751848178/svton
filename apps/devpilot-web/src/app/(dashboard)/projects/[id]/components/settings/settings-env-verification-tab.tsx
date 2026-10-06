'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type { ProjectEnvironment, ProjectSite } from '../../types';
import type { EnvironmentConfigRevision } from '../../types/environment-config-revision.types';
import type { DeploymentRun } from '../../types/operations';
import type { SettingsObservabilityDraft } from './settings-env.model';
import { SettingsObservabilityModal } from './settings-observability-modal';
import { SubtabShell } from './settings-subtab-shell';
import { buildVerificationEvidenceRows } from './settings-verification-evidence.model';
import { SettingsVerificationEvidenceTable } from './settings-verification-evidence-table';

export function EnvVerificationTab(props: {
  projectId: string;
  value: SettingsObservabilityDraft['profile'];
  onChange: (next: SettingsObservabilityDraft['profile']) => void;
  environment: ProjectEnvironment;
  sites: ProjectSite[];
  deploymentRuns: DeploymentRun[];
  revision: EnvironmentConfigRevision | null;
  evidenceError: string;
  onRetryEvidence: () => void;
}) {
  const t = useTranslations('projects');
  const environmentLabel = `${props.environment.name} (${props.environment.key})`;
  const snapshot = props.revision?.observabilitySnapshot;
  const rows = buildVerificationEvidenceRows({
    environment: props.environment,
    snapshot,
    sites: props.sites,
    deploymentRuns: props.deploymentRuns,
  });
  const savedProfile = snapshot?.profile ?? '';
  return (
    <SubtabShell
      title={t('envTabVerification')}
      helper={t('envTabHelperVerification')}
      actions={(
        <SettingsObservabilityModal
          value={props.value}
          onChange={props.onChange}
          environmentLabel={environmentLabel}
        />
      )}
    >
      <div className="space-y-4">
        {savedProfile === 'local_acceptance_v1' ? (
          <p className="rounded-md border px-3 py-2 text-sm text-amber-800">
            {t('environmentVerificationLocalWarning', { environment: environmentLabel })}
          </p>
        ) : null}
        {props.value !== savedProfile ? (
          <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            {t('environmentVerificationDraftPending')}
          </p>
        ) : null}
        {props.evidenceError ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span>{t('environmentVerificationLoadFailed')}</span>
            <Button variant="ghost" className="min-h-11" onClick={props.onRetryEvidence}>
              {t('environmentVerificationRetry')}
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {t('environmentVerificationSavedProfile')}{' '}
            <b className="font-medium text-foreground">
              {t(profileLabelKey(savedProfile) as never)}
            </b>
          </span>
          <span>
            {props.revision
              ? t('environmentVerificationRevision', { revision: props.revision.revision })
              : t('environmentVerificationNoRevision')}
          </span>
        </div>
        <SettingsVerificationEvidenceTable projectId={props.projectId} rows={rows} />
      </div>
    </SubtabShell>
  );
}

function profileLabelKey(profile: string) {
  if (profile === 'local_acceptance_v1') return 'environmentObservabilityLocal';
  if (profile === 'external_provider_v1') return 'environmentObservabilityExternal';
  return 'environmentObservabilityUnconfigured';
}
