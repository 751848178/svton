'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useReleaseBuilds } from '../hooks/use-release-builds';
import type { ReleaseOrderEvidenceHook } from '../hooks/use-release-order-evidence';
import { useProductionReleases } from '../hooks/use-production-releases';
import { useProductionPromotionResume } from '../hooks/use-production-promotion-resume';
import { useReleaseProductionFocusNormalizer } from '../hooks/use-release-production-focus-normalizer';
import { useReleaseStagingDeployments } from '../hooks/use-release-staging-deployments';
import { releaseProductionErrorLabelKey } from '../utils/release-copy.model';
import { ReleaseProductionApprovalCard } from './release-production-approval-card';
import { ReleaseProductionConfirmDialog } from './release-production-confirm-dialog';
import { ReleaseProductionEvidenceSection } from './release-production-evidence-section';
import { ReleaseProductionLegacyRecoveryAlert } from './release-production-legacy-recovery-alert';
import { ReleaseProductionPrimaryAction } from './release-production-primary-action';
import { releaseProductionCurrentRun } from './release-production-current-run.model';
import { ReleaseProductionPromotionProgress } from './release-production-promotion-progress';
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
  const current = useMemo(
    () => releaseProductionCurrentRun(
      releaseRuns,
      props.focusedReleaseRunId,
      props.releaseOrderId,
    ),
    [props.focusedReleaseRunId, props.releaseOrderId, releaseRuns],
  );
  const approvalRun = current.approvalRun;
  const promotion = useProductionPromotionResume(
    props.projectId,
    current.awaitingResume?.environmentId || '',
    props.onChanged,
  );

  const focusedRun = releaseRuns.find((run) =>
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

  const stageCopy = productionStageCopy(approvalRun, current.succeededOnline);

  const primaryAction = (
    <ReleaseProductionPrimaryAction
      frozen={props.productionArtifactFrozen}
      needsRecovery={current.needsRecovery}
      legacyRecovery={Boolean(current.legacyRecovery)}
      active={current.active}
      runStatus={approvalRun?.status}
      approvalStatus={approvalRun?.operationApproval.status}
      recoveryHref={props.recoveryHref}
      awaitingValidationReady={Boolean(current.awaitingResume)}
      resuming={promotion.resuming}
      snapshotReady={Boolean(snapshot)}
      confirming={production.confirming}
      onRequest={() => setDialogOpen(true)}
      onResume={() => {
        if (current.awaitingResume) void promotion.resume(current.awaitingResume.input);
      }}
    />
  );

  return (
    <div className="space-y-4">
      <ReleaseProductionStageCard
        currentOnline={current.currentOnline}
        releaseVersion={props.releaseVersion}
        pendingApprovals={current.pendingApprovals}
        online={current.succeededOnline}
        titleKey={stageCopy.titleKey}
        descriptionKey={stageCopy.descriptionKey}
        primaryAction={primaryAction}
        manifestId={manifestId}
        candidates={candidates}
        selectDisabled={builds.loading || staging.loading || production.confirming || current.active}
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
      <ReleaseProductionPromotionProgress run={approvalRun} />
      {current.legacyRecovery ? (
        <ReleaseProductionLegacyRecoveryAlert />
      ) : null}
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
      {promotion.error ? (
        <p className="text-sm text-destructive" role="alert">{promotion.error}</p>
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
