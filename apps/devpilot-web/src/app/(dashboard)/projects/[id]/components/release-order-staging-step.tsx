'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { Button, EmptyState, ErrorBanner } from '@/components/ui';
import { useReleaseBuilds } from '../hooks/use-release-builds';
import { useReleaseStagingDeployments } from '../hooks/use-release-staging-deployments';
import { releaseClientErrorLabelKey } from '../utils/release-copy.model';
import { stagingBuildForRun, stagingManifestSucceeded } from '../utils/release-staging-view.model';
import { ReleaseStagingEvidenceList } from './release-staging-evidence-list';
import { ReleaseStagingLogDrawer } from './release-staging-log-drawer';

interface Props {
  projectId: string;
  releaseOrderId: string;
  onChanged: () => Promise<unknown>;
  focusedDeploymentRunId?: string;
  onOpenLog: (deploymentRunId: string) => void;
  onCloseLog: () => void;
}

export function ReleaseOrderStagingStep(props: Props) {
  const t = useTranslations('projects');
  const deployments = useReleaseStagingDeployments(
    props.projectId,
    props.releaseOrderId,
    props.onChanged,
  );
  const builds = useReleaseBuilds(props.projectId, props.releaseOrderId, props.onChanged);
  const manifests = useMemo(
    () => builds.items.filter((item) => item.status === 'succeeded' && item.manifest),
    [builds.items],
  );
  const [requestedManifestId, setRequestedManifestId] = useState('');
  const manifestId = manifests.some((item) => item.manifest?.id === requestedManifestId)
    ? requestedManifestId
    : manifests[0]?.manifest?.id || '';
  const selectedBuild = manifests.find((item) => item.manifest?.id === manifestId) || null;
  const focusedRun =
    deployments.items.find((item) => item.id === props.focusedDeploymentRunId) || null;
  const focusedBuild = focusedRun ? stagingBuildForRun(focusedRun, builds.items) : null;
  const normalizedFocus = useRef<string | null>(null);
  const onCloseLog = props.onCloseLog;

  useEffect(() => {
    const runId = props.focusedDeploymentRunId;
    if (!runId || focusedRun || deployments.error) {
      normalizedFocus.current = null;
      return;
    }
    if (!deployments.loadedSuccessfully || deployments.loading || normalizedFocus.current === runId)
      return;
    normalizedFocus.current = runId;
    onCloseLog();
  }, [
    deployments.error,
    deployments.loadedSuccessfully,
    deployments.loading,
    focusedRun,
    onCloseLog,
    props.focusedDeploymentRunId,
  ]);

  const deploymentErrorKey = releaseClientErrorLabelKey(deployments.error);
  const deploy = (id: string) => void deployments.deploy(id);
  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-muted/20 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h3 className="font-semibold">{t('releaseStepStagingTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('releaseStepStagingDescription')}
            </p>
          </div>
          <Button
            onClick={() => deploy(manifestId)}
            loading={deployments.deploying}
            disabled={!manifestId}
          >
            {t('deployManifestToStaging')}
          </Button>
        </div>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium">{t('releaseStagingManifestLabel')}</span>
          <select
            className="w-full rounded-md border bg-background px-3 py-2"
            value={manifestId}
            onChange={(event) => setRequestedManifestId(event.target.value)}
            disabled={builds.loading || deployments.deploying}
            title={
              selectedBuild?.manifest
                ? t('releaseStagingManifestOption', {
                    buildId: selectedBuild.id,
                    revision: selectedBuild.revision,
                    manifestId: selectedBuild.manifest.id,
                    digest: selectedBuild.manifest.digest.slice(0, 19),
                  })
                : undefined
            }
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
                  buildId: shortId(build.id),
                  revision: build.revision,
                  manifestId: shortId(build.manifest!.id),
                  digest: build.manifest!.digest.slice(0, 19),
                })}
              </option>
            ))}
          </select>
        </label>
      </section>
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary
          label={t('releaseStagingCurrentArtifact')}
          value={
            selectedBuild
              ? `BuildRun ${selectedBuild.id} · R${selectedBuild.revision}`
              : t('releaseStagingNoManifest')
          }
          detail={selectedBuild?.manifest ? `Manifest ${selectedBuild.manifest.id}` : undefined}
        />
        <Summary
          label={t('releaseStagingDeploymentCount')}
          value={t('releaseStagingDeploymentCountValue', { count: deployments.total })}
        />
        <Summary
          label={t('releaseStagingProductionPrerequisite')}
          value={
            manifestId && stagingManifestSucceeded(manifestId, deployments.items)
              ? t('releaseStagingProductionReady')
              : t('releaseStagingProductionWaiting')
          }
        />
      </div>
      {builds.error ? (
        <ErrorBanner
          message={builds.error}
          onRetry={builds.load}
        />
      ) : null}
      {deployments.error ? (
        <ErrorBanner
          message={deploymentErrorKey ? t(deploymentErrorKey) : deployments.error}
          onRetry={deployments.load}
        />
      ) : null}
      {(builds.loading && manifests.length === 0) ||
      (deployments.loading && deployments.items.length === 0) ? (
        <LoadingState text={t('releaseStagingLoading')} />
      ) : null}
      {!deployments.loading && deployments.loadedSuccessfully && deployments.items.length === 0 ? (
        <EmptyState title={t('releaseStepStagingEmpty')} />
      ) : null}
      {deployments.items.length > 0 ? (
        <ReleaseStagingEvidenceList
          items={deployments.items}
          builds={builds.items}
          total={deployments.total}
          focusedRunId={props.focusedDeploymentRunId}
          deploying={deployments.deploying}
          onOpenLog={props.onOpenLog}
          onDeploy={deploy}
        />
      ) : null}
      <ReleaseStagingLogDrawer
        projectId={props.projectId}
        run={focusedRun}
        build={focusedBuild}
        requestedRunId={props.focusedDeploymentRunId}
        loading={Boolean(props.focusedDeploymentRunId) && deployments.loading}
        error={deployments.error}
        onRetry={deployments.load}
        onClose={props.onCloseLog}
      />
    </div>
  );
}

function Summary(props: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-md border p-3">
      <span className="text-xs text-muted-foreground">{props.label}</span>
      <strong className="mt-1 block break-all text-sm">{props.value}</strong>
      {props.detail ? (
        <code className="mt-1 block break-all text-xs text-muted-foreground">{props.detail}</code>
      ) : null}
    </div>
  );
}

function shortId(value: string) {
  return value.length > 16 ? `${value.slice(0, 12)}…` : value;
}
