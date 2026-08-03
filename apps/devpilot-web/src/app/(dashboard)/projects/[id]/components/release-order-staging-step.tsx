'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, StatusTag } from '@/components/ui';
import { useReleaseBuilds } from '../hooks/use-release-builds';
import { useReleaseStagingDeployments } from '../hooks/use-release-staging-deployments';
import { releaseOrderStatusTone } from '../utils/release-order.utils';

interface Props {
  projectId: string;
  releaseOrderId: string;
  onChanged: () => Promise<unknown>;
}

export function ReleaseOrderStagingStep(props: Props) {
  const t = useTranslations('projects');
  const builds = useReleaseBuilds(props.projectId, props.releaseOrderId, props.onChanged);
  const deployments = useReleaseStagingDeployments(props.projectId, props.releaseOrderId);
  const manifests = useMemo(() => builds.items.filter((item) => item.manifest), [builds.items]);
  const [requestedManifestId, setRequestedManifestId] = useState('');
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
            {manifests.length === 0 ? <option value="">{t('releaseStagingNoManifest')}</option> : null}
            {manifests.map((build) => (
              <option key={build.manifest!.id} value={build.manifest!.id}>
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
      {deployments.error ? <p className="text-sm text-destructive" role="alert">{deployments.error}</p> : null}
      {!deployments.loading && deployments.items.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {t('releaseStepStagingEmpty')}
        </p>
      ) : null}
      <div className="space-y-3">
        {deployments.items.map((run, index) => (
          <article key={run.id} className="rounded-md border p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <strong>{t('releaseStagingRun', { number: deployments.items.length - index })}</strong>
              <StatusTag status={releaseOrderStatusTone(run.status)} label={run.status} />
            </div>
            <p className="mt-2 break-all font-mono text-xs">Manifest {run.artifactManifestId}</p>
            <p className="mt-1 font-mono text-xs">{run.branch}@{run.commitSha}</p>
            {run.error ? <p className="mt-2 text-destructive">{run.error}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
