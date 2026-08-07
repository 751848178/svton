'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { Button, EmptyState, ErrorBanner, LinkButton } from '@/components/ui';
import { useReleaseBuilds } from '../hooks/use-release-builds';
import type { ReleaseOrderEvidenceHook } from '../hooks/use-release-order-evidence';
import { useProductionReleases } from '../hooks/use-production-releases';
import { useReleaseStagingDeployments } from '../hooks/use-release-staging-deployments';
import { releaseProductionErrorLabelKey } from '../utils/release-copy.model';
import type {
  ReleaseEvidenceDeploymentRun,
  ReleaseEvidenceProductionRun,
} from '../types/release-order-evidence.types';
import { ReleaseProductionApprovalCard } from './release-production-approval-card';
import { ReleaseProductionConfirmDialog } from './release-production-confirm-dialog';
import { ReleaseProductionEvidenceList } from './release-production-evidence-list';
import { ReleaseProductionLogDrawer } from './release-production-log-drawer';

interface Props {
  projectId: string;
  releaseOrderId: string;
  releaseVersion: string;
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
  const normalizedFocus = useRef<string | null>(null);
  const onCloseLog = props.onCloseLog;

  useEffect(() => {
    const runId = props.focusedDeploymentRunId;
    if (!runId || focusedDeployment || props.evidence.error) {
      normalizedFocus.current = null;
      return;
    }
    if (!props.evidence.loading && normalizedFocus.current !== runId) {
      normalizedFocus.current = runId;
      onCloseLog();
    }
  }, [
    focusedDeployment,
    onCloseLog,
    props.evidence.error,
    props.evidence.loading,
    props.focusedDeploymentRunId,
  ]);

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
    ? ['awaiting_approval', 'approved', 'running'].includes(approvalRun.status) ||
      approvalRun.operationApproval.status === 'pending'
    : false;
  const needsRecovery = Boolean(
    approvalRun &&
    (approvalRun.status === 'failed' || approvalRun.operationApproval.status === 'rejected'),
  );
  const stageTitle = stageTitleKey(approvalRun, succeededOnline);
  const stageDescription = t(stageTitle.descriptionKey);

  const primaryAction = renderPrimaryAction();

  return (
    <div className="space-y-4">
      <ContextStrip
        currentOnline={currentOnline}
        releaseVersion={props.releaseVersion}
        orderStatus={t('releaseStepProductionTitle')}
        pendingApprovals={pendingApprovals}
        online={succeededOnline}
      />
      <section className="rounded-lg border p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h3 className="font-semibold">{t(stageTitle.titleKey)}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{stageDescription}</p>
          </div>
          <div className="shrink-0">{primaryAction}</div>
        </div>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium">{t('releaseProductionManifestLabel')}</span>
          <select
            className="w-full rounded-md border bg-background px-3 py-2"
            value={manifestId}
            onChange={(event) => {
              setRequestedManifestId(event.target.value);
              setDialogOpen(false);
            }}
            disabled={builds.loading || staging.loading || production.confirming || activeRun}
          >
            {candidates.length === 0 ? (
              <option value="">{t('releaseProductionNoManifest')}</option>
            ) : null}
            {candidates.map((build) => (
              <option
                key={build.manifest!.id}
                value={build.manifest!.id}
              >
                {t('releaseProductionManifestOption', {
                  revision: build.revision,
                  digest: build.manifest!.digest.slice(0, 19),
                })}
              </option>
            ))}
          </select>
        </label>
      </section>
      <StageSummary
        currentOnline={currentOnline}
        frozenManifest={approvalRun?.manifest.digest || (snapshot?.manifest.digest ?? '')}
        online={succeededOnline}
        preflightReady={manifestId ? provenManifestIds.has(manifestId) : false}
      />
      <ReleaseProductionConfirmDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        snapshot={snapshot ?? null}
        confirming={production.confirming}
        error={productionErrorKey ? t(productionErrorKey) : ''}
        onConfirm={production.confirm}
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
      {builds.error ? (
        <ErrorBanner
          message={builds.error}
          onRetry={builds.load}
        />
      ) : null}
      {staging.error ? (
        <ErrorBanner
          message={stagingErrorKey ? t(stagingErrorKey) : staging.error}
          onRetry={staging.load}
        />
      ) : null}
      {props.evidence.error ? (
        <ErrorBanner
          message={props.evidence.error}
          onRetry={props.evidence.load}
        />
      ) : null}
      {props.evidence.loading && !evidence ? <LoadingState /> : null}
      {!props.evidence.loading && evidence?.productionReleaseRuns.items.length === 0 ? (
        <EmptyState title={t('releaseStepProductionEmpty')} />
      ) : null}
      {evidence ? (
        <ReleaseProductionEvidenceList
          projectId={props.projectId}
          items={evidence.productionReleaseRuns.items}
          total={evidence.productionReleaseRuns.total}
          focusedReleaseRunId={props.focusedReleaseRunId}
          focusedDeploymentRunId={props.focusedDeploymentRunId}
          recoveryHref={props.recoveryHref}
          onFocus={props.onFocus}
          onOpenLog={(deploymentRunId) => {
            const releaseRun = releaseRuns.find((run) =>
              run.deploymentRuns.some((deployment) => deployment.id === deploymentRunId),
            );
            props.onOpenLog(releaseRun?.id || approvalRun?.id || '', deploymentRunId);
          }}
        />
      ) : null}
      <ReleaseProductionLogDrawer
        projectId={props.projectId}
        run={focusedDeployment}
        releaseRun={focusedRun}
        requestedRunId={props.focusedDeploymentRunId}
        loading={Boolean(props.focusedDeploymentRunId) && props.evidence.loading}
        error={props.evidence.error}
        onRetry={props.evidence.load}
        onClose={props.onCloseLog}
      />
    </div>
  );

  function renderPrimaryAction() {
    if (needsRecovery) {
      return (
        <LinkButton
          data-primary="true"
          href={props.recoveryHref}
        >
          {t('releaseProductionRecoveryLink')}
        </LinkButton>
      );
    }
    if (activeRun) {
      return (
        <Button disabled>
          {approvalRun?.status === 'running'
            ? t('releaseProductionRunningDisabled')
            : approvalRun?.operationApproval.status === 'approved'
              ? t('releaseProductionAwaitingExecuteDisabled')
              : t('releaseProductionAwaitingApprovalDisabled')}
        </Button>
      );
    }
    return (
      <Button
        data-primary="true"
        onClick={() => setDialogOpen(true)}
        disabled={!snapshot || production.confirming}
      >
        {t('requestProductionApproval')}
      </Button>
    );
  }
}

function ContextStrip(props: {
  currentOnline: string;
  releaseVersion: string;
  orderStatus: string;
  pendingApprovals: number;
  online: boolean;
}) {
  const t = useTranslations('projects');
  return (
    <section
      className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4"
      data-context-strip="true"
    >
      <ContextItem
        label={t('releaseContextCurrentOnline')}
        value={
          props.online && props.currentOnline
            ? `${shortDigest(props.currentOnline)} · ${t('releaseContextRunningNormally')}`
            : t('releaseContextNotOnline')
        }
      />
      <ContextItem
        label={t('releaseContextDelivering')}
        value={`${props.releaseVersion} · ${props.orderStatus}`}
      />
      <ContextItem
        label={t('releaseContextTodos')}
        value={t('releaseContextTodoCount', { count: props.pendingApprovals })}
      />
      <ContextItem
        label={t('releaseContextReleaseOrder')}
        value={`${t('releaseContextStagingFirst')} → ${t('releaseContextProductionLast')}`}
      />
    </section>
  );
}

function StageSummary(props: {
  currentOnline: string;
  frozenManifest: string;
  online: boolean;
  preflightReady: boolean;
}) {
  const t = useTranslations('projects');
  return (
    <section
      className="grid gap-3 sm:grid-cols-3"
      data-stage-summary="true"
    >
      <SummaryCard
        label={t('releaseStageSummaryCurrentOnline')}
        value={
          props.online && props.currentOnline
            ? shortDigest(props.currentOnline)
            : t('releaseStageSummaryNotOnline')
        }
      />
      <SummaryCard
        label={t('releaseStageSummaryArtifact')}
        value={
          props.frozenManifest
            ? shortDigest(props.frozenManifest)
            : t('releaseStageSummaryNotFrozen')
        }
      />
      <SummaryCard
        label={t('releaseStageSummaryPrerequisite')}
        value={
          props.preflightReady
            ? t('releaseStageSummaryPrerequisiteReady')
            : t('releaseStageSummaryPrerequisitePending')
        }
      />
    </section>
  );
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className="mt-0.5 block break-all">{value}</strong>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className="mt-1 block break-all text-sm">{value}</strong>
    </div>
  );
}

function shortDigest(value: string) {
  return value.length > 19 ? `${value.slice(0, 19)}…` : value;
}

function stageTitleKey(
  run: ReleaseEvidenceProductionRun | null,
  online: boolean,
): { titleKey: string; descriptionKey: string } {
  if (!run) {
    return {
      titleKey: 'releaseStageCalloutProduction',
      descriptionKey: 'releaseProductionDescription',
    };
  }
  const status = run.status.toLowerCase();
  if (run.operationApproval.status === 'pending') {
    return {
      titleKey: 'releaseStageCalloutAwaitingApproval',
      descriptionKey: 'releaseProductionDescription',
    };
  }
  if (status === 'running') {
    return {
      titleKey: 'releaseStageCalloutRunning',
      descriptionKey: 'releaseProductionDescription',
    };
  }
  if (['succeeded', 'completed'].includes(status)) {
    return {
      titleKey: 'releaseStageCalloutOnlineHealthy',
      descriptionKey: 'releaseStageCalloutOnlineHealthyDetail',
    };
  }
  if (online) {
    return {
      titleKey: 'releaseStageCalloutHistoricalOnline',
      descriptionKey: 'releaseStageCalloutHistoricalOnlineDetail',
    };
  }
  if (status === 'failed' || run.operationApproval.status === 'rejected') {
    return {
      titleKey: 'releaseStageCalloutFailed',
      descriptionKey: 'releaseStageCalloutFailedDetail',
    };
  }
  return {
    titleKey: 'releaseStageCalloutProduction',
    descriptionKey: 'releaseProductionDescription',
  };
}
