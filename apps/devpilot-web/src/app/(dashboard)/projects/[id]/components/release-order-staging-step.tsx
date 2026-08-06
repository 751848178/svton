'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { Button, ErrorBanner } from '@/components/ui';
import { useReleaseBuilds } from '../hooks/use-release-builds';
import type { ReleaseOrderEvidenceHook } from '../hooks/use-release-order-evidence';
import { useReleaseStagingDeployments } from '../hooks/use-release-staging-deployments';
import { releaseClientErrorLabelKey } from '../utils/release-copy.model';
import { ReleaseStagingEvidenceList } from './release-staging-evidence-list';

interface Props {
  projectId: string;
  releaseOrderId: string;
  onChanged: () => Promise<unknown>;
  evidence: ReleaseOrderEvidenceHook;
  focusedDeploymentRunId?: string;
  onFocus: (deploymentRunId: string) => void;
}

export function ReleaseOrderStagingStep(props: Props) {
  const t = useTranslations('projects');
  const deployments = useReleaseStagingDeployments(
    props.projectId,
    props.releaseOrderId,
    props.onChanged,
  );
  const builds = useReleaseBuilds(props.projectId, props.releaseOrderId, props.onChanged);
  const evidence = props.evidence.evidence;
  const manifests = useMemo(
    () => builds.items.filter((item) => item.status === 'succeeded' && item.manifest),
    [builds.items],
  );
  const [requestedManifestId, setRequestedManifestId] = useState('');
  const deploymentErrorKey = releaseClientErrorLabelKey(deployments.error);
  const manifestId = manifests.some((item) => item.manifest?.id === requestedManifestId)
    ? requestedManifestId
    : manifests[0]?.manifest?.id || '';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">{t('releaseStepStagingTitle')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('releaseStepStagingDescription')}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-md border p-4">
        <label className="min-w-64 flex-1 text-sm">
          <span className="mb-1 block font-medium">{t('releaseStagingManifestLabel')}</span>
          <select
            className="w-full rounded-md border bg-background px-3 py-2"
            value={manifestId}
            onChange={(event) => setRequestedManifestId(event.target.value)}
            disabled={builds.loading || deployments.deploying}
          >
            {manifests.length === 0 ? (
              <option value="">{t('releaseStagingNoManifest')}</option>
            ) : null}
            {manifests.map((build) => (
              <option
                key={build.manifest!.id}
                value={build.manifest!.id}
              >
                {t('releaseStagingManifestOption', {
                  revision: build.revision,
                  digest: build.manifest!.digest.slice(0, 19),
                })}
              </option>
            ))}
          </select>
        </label>
        <Button
          onClick={() => void deployments.deploy(manifestId)}
          loading={deployments.deploying}
          disabled={!manifestId}
        >
          {t('deployManifestToStaging')}
        </Button>
      </div>
      {props.evidence.error ? (
        <ErrorBanner
          message={props.evidence.error}
          onRetry={props.evidence.load}
        />
      ) : null}
      {builds.error ? (
        <ErrorBanner
          message={builds.error}
          onRetry={builds.load}
        />
      ) : null}
      {deployments.error ? (
        <p
          className="text-sm text-destructive"
          role="alert"
        >
          {deploymentErrorKey ? t(deploymentErrorKey) : deployments.error}
        </p>
      ) : null}
      {props.evidence.loading && !evidence ? <LoadingState /> : null}
      {!props.evidence.loading && evidence?.stagingDeploymentRuns.items.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {t('releaseStepStagingEmpty')}
        </p>
      ) : null}
      {evidence ? (
        <ReleaseStagingEvidenceList
          projectId={props.projectId}
          items={evidence.stagingDeploymentRuns.items}
          total={evidence.stagingDeploymentRuns.total}
          focusedRunId={props.focusedDeploymentRunId}
          onFocus={props.onFocus}
        />
      ) : null}
    </div>
  );
}
