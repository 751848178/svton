'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useReleaseBuilds } from '../hooks/use-release-builds';
import type { ReleaseOrderEvidenceHook } from '../hooks/use-release-order-evidence';
import { useProductionReleases } from '../hooks/use-production-releases';
import { useReleaseProductionFocusNormalizer } from '../hooks/use-release-production-focus-normalizer';
import { useReleaseStagingDeployments } from '../hooks/use-release-staging-deployments';
import { releaseProductionErrorLabelKey } from '../utils/release-copy.model';
import { ReleaseProductionApprovalCard } from './release-production-approval-card';
import { ReleaseProductionConfirmDialog } from './release-production-confirm-dialog';
import { ReleaseProductionEvidenceSection } from './release-production-evidence-section';
import { ReleaseProductionPrimaryAction } from './release-production-primary-action';
import {
  productionStageCopy,
  ReleaseProductionStageCard,
} from './release-production-stage-card';

interface Props {
  projectId: string;
  releaseOrderId: string;
  releaseVersion: string;
  productionArtifactFrozen: boolean;
  onChanged: () => Promise<unknown>;
  evidence: ReleaseOrderEvidenceHook;
  focusedReleaseRunId?: string;
  focusedDeploymentRunId?: string;
  recoveryHref: string;
  onFocus: (releaseRunId: string, deploymentRunId?: string) => void;
  onOpenLog: (releaseRunId: string, deploymentRunId: string) => void;
  onCloseLog: () => void;
}

export function ReleaseOrderProductionStep(props: Props) {
  const t = useTranslations('projects');
  const builds = useReleaseBuilds(props.projectId, props.releaseOrderId, props.onChanged);
  const staging = useReleaseStagingDeployments(props.projectId, props.releaseOrderId);
  const evidence = props.evidence.evidence;
  const provenManifestIds = useMemo(
    () =>
      new Set(
        staging.items
          .filter((item) => item.status === 'completed' && item.artifactManifestId)
          .map((item) => item.artifactManifestId as string),
      ),
    [staging.items],
  );
  const candidates = useMemo(
    () => builds.items.filter((item) => item.manifest && provenManifestIds.has(item.manifest.id)),
    [builds.items, provenManifestIds],
  );
  const [requestedManifestId, setRequestedManifestId] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const manifestId = candidates.some((item) => item.manifest?.id === requestedManifestId)
    ? requestedManifestId
    : candidates[0]?.manifest?.id || '';
  const production = useProductionReleases(
    props.projectId,
    props.releaseOrderId,
    manifestId,
    props.onChanged,
    !props.productionArtifactFrozen,
  );
  const snapshot = production.preview?.snapshot;
  const stagingErrorKey = useMemo(
    () => (staging.error ? releaseProductionErrorLabelKey(staging.error) : null),
    [staging.error],
  );
  const productionErrorKey = production.error
    ? releaseProductionErrorLabelKey(production.error)
    : null;
  const releaseRuns = evidence?.productionReleaseRuns.items || [];
  const approvalRun = useMemo(() => {
    if (props.focusedReleaseRunId) {
      const focused = releaseRuns.find((run) => run.id === props.focusedReleaseRunId);
      if (focused) return focused;
    }
    return releaseRuns[0] || null;
  }, [props.focusedReleaseRunId, releaseRuns]);

  const focusedRun =
    releaseRuns.find((run) =>
      run.deploymentRuns.some((deployment) => deployment.id === props.focusedDeploymentRunId),
    ) || null;
  const focusedDeployment =
    focusedRun?.deploymentRuns.find(
      (deployment) => deployment.id === props.focusedDeploymentRunId,
    ) || null;
  useReleaseProductionFocusNormalizer({
    requestedRunId: props.focusedDeploymentRunId,
    found: Boolean(focusedDeployment),
    loading: props.evidence.loading,
    error: props.evidence.error,
    onClose: props.onCloseLog,
  });

  const succeededOnline = releaseRuns.some((run) =>
    ['succeeded', 'completed'].includes(run.status.toLowerCase()),
  );
  const currentOnline = useMemo(() => {
    const latest = releaseRuns.find((run) =>
      ['succeeded', 'completed'].includes(run.status.toLowerCase()),
    );
    return latest?.verifiedDigest || '';
  }, [releaseRuns]);
  const pendingApprovals = releaseRuns.filter(
    (run) => run.operationApproval.status === 'pending',
  ).length;
  const activeRun = approvalRun
    ? ['awaiting_approval', 'approved', 'running', 'awaiting_validation'].includes(approvalRun.status) ||
      approvalRun.operationApproval.status === 'pending'
    : false;
  const needsRecovery = Boolean(
    approvalRun &&
    (approvalRun.status === 'failed' || approvalRun.operationApproval.status === 'rejected'),
  );
  const stageCopy = productionStageCopy(approvalRun, succeededOnline);

  const primaryAction = (
    <ReleaseProductionPrimaryAction
      frozen={props.productionArtifactFrozen}
      needsRecovery={needsRecovery}
      active={activeRun}
      runStatus={approvalRun?.status}
      approvalStatus={approvalRun?.operationApproval.status}
      recoveryHref={props.recoveryHref}
      awaitingValidationHref={`/projects/${encodeURIComponent(props.projectId)}?view=environment-versions`}
      snapshotReady={Boolean(snapshot)}
      confirming={production.confirming}
      onRequest={() => setDialogOpen(true)}
    />
  );

  return (
    <div className="space-y-4">
      <ReleaseProductionStageCard
        currentOnline={currentOnline}
        releaseVersion={props.releaseVersion}
        pendingApprovals={pendingApprovals}
        online={succeededOnline}
        titleKey={stageCopy.titleKey}
        descriptionKey={stageCopy.descriptionKey}
        primaryAction={primaryAction}
        manifestId={manifestId}
        candidates={candidates}
        selectDisabled={builds.loading || staging.loading || production.confirming || activeRun}
        onManifestChange={(next) => {
          setRequestedManifestId(next);
          setDialogOpen(false);
        }}
        frozenManifest={approvalRun?.manifest.digest || (snapshot?.manifest.digest ?? '')}
        preflightReady={manifestId ? provenManifestIds.has(manifestId) : false}
        dialog={<ReleaseProductionConfirmDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          snapshot={snapshot ?? null}
          confirming={production.confirming}
          error={productionErrorKey ? t(productionErrorKey) : ''}
          onConfirm={production.confirm}
        />}
      />
      {approvalRun ? (
        <ReleaseProductionApprovalCard
          projectId={props.projectId}
          run={approvalRun}
          onChanged={props.onChanged}
          recoveryHref={props.recoveryHref}
        />
      ) : null}
      {production.error && productionErrorKey ? (
        <p
          className="text-sm text-destructive"
          role="alert"
        >
          {t(productionErrorKey)}
        </p>
      ) : null}
      <ReleaseProductionEvidenceSection
        projectId={props.projectId}
        evidence={props.evidence}
        releaseRuns={releaseRuns}
        approvalRunId={approvalRun?.id}
        focusedRun={focusedRun}
        focusedDeployment={focusedDeployment}
        focusedReleaseRunId={props.focusedReleaseRunId}
        focusedDeploymentRunId={props.focusedDeploymentRunId}
        recoveryHref={props.recoveryHref}
        buildsError={builds.error}
        onRetryBuilds={builds.load}
        stagingError={stagingErrorKey ? t(stagingErrorKey) : staging.error}
        onRetryStaging={staging.load}
        onFocus={props.onFocus}
        onOpenLog={props.onOpenLog}
        onCloseLog={props.onCloseLog}
      />
    </div>
  );
}
