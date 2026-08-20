'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { EmptyState, ErrorBanner } from '@/components/ui';
import { useReleaseBuilds } from '../hooks/use-release-builds';
import { useReleaseStagingDeployments } from '../hooks/use-release-staging-deployments';
import { releaseClientErrorLabelKey } from '../utils/release-copy.model';
import { stagingBuildForRun, stagingManifestSucceeded } from '../utils/release-staging-view.model';
import { ReleaseStagingEvidenceList } from './release-staging-evidence-list';
import { ReleaseStagingDeployControl } from './release-staging-deploy-control';
import { ReleaseStagingLogDrawer } from './release-staging-log-drawer';
import { ReleaseStagingSummary as Summary } from './release-staging-summary';

interface Props {
  projectId: string;
  releaseOrderId: string;
  onChanged: () => Promise<unknown>;
  focusedDeploymentRunId?: string;
  onOpenLog: (deploymentRunId: string) => void;
  onCloseLog: () => void;
  stagingGate?: { allowed: boolean; reason: string };
  repairHref?: string;
  decisionShown?: boolean;
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
  }, [deployments.error, deployments.loadedSuccessfully, deployments.loading, focusedRun, onCloseLog, props.focusedDeploymentRunId]);

  const deploymentErrorKey = releaseClientErrorLabelKey(deployments.error);
  const deploy = (id: string) => {
    if (props.stagingGate?.allowed !== false) void deployments.deploy(id);
  };
  return (
    <div className="space-y-4">
      <ReleaseStagingDeployControl
        manifestId={manifestId}
        manifests={manifests}
        selectedBuild={selectedBuild}
        buildsLoading={builds.loading}
        deploying={deployments.deploying}
        gateAllowed={props.stagingGate?.allowed !== false}
        gateReason={props.stagingGate?.reason || undefined}
        decisionShown={props.decisionShown}
        onManifestChange={setRequestedManifestId}
        onDeploy={deploy}
      />
      {props.stagingGate?.allowed === false && !props.decisionShown ? (
        <p
          role="alert"
          className="text-sm text-amber-800"
        >
          {props.stagingGate.reason}{' '}
          {props.repairHref ? (
            <a
              className="font-medium underline"
              href={props.repairHref}
            >
              {t('releaseGateRepairAction')}
            </a>
          ) : null}
        </p>
      ) : null}
      <dl className="grid divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Summary
          label={t('releaseStagingCurrentArtifact')}
          value={
            selectedBuild
              ? `BuildRun ${selectedBuild.id} · R${selectedBuild.revision}`
              : t('releaseStagingNoManifest')
          }
          detail={selectedBuild?.manifest ? `Manifest ${selectedBuild.manifest.id}` : undefined}
        />
        <Summary label={t('releaseStagingDeploymentCount')} value={t('releaseStagingDeploymentCountValue', { count: deployments.total })} />
        <Summary label={t('releaseStagingProductionPrerequisite')}
          value={
            manifestId && stagingManifestSucceeded(manifestId, deployments.items)
              ? t('releaseStagingProductionReady')
              : t('releaseStagingProductionWaiting')
          }
        />
      </dl>
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
      {!deployments.loading && deployments.loadedSuccessfully && deployments.items.length === 0 ? <EmptyState title={t('releaseStepStagingEmpty')} /> : null}
      {deployments.items.length > 0 ? (
        <ReleaseStagingEvidenceList
          items={deployments.items}
          builds={builds.items}
          total={deployments.total}
          focusedRunId={props.focusedDeploymentRunId}
          deploying={deployments.deploying}
          deploymentAllowed={props.stagingGate?.allowed !== false}
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
