'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { ReleaseBuildItem } from '../types/release-order.types';
import type { ReleaseEvidenceProductionRun } from '../types/release-order-evidence.types';

export function ReleaseProductionStageCard(props: {
  currentOnline: string;
  releaseVersion: string;
  pendingApprovals: number;
  online: boolean;
  titleKey: string;
  descriptionKey: string;
  primaryAction: ReactNode;
  manifestId: string;
  candidates: ReleaseBuildItem[];
  selectDisabled: boolean;
  onManifestChange: (manifestId: string) => void;
  frozenManifest: string;
  preflightReady: boolean;
  dialog: ReactNode;
}) {
  const t = useTranslations('projects');
  return (
    <>
      <ContextStrip {...props} orderStatus={t('releaseStepProductionTitle')} />
      <section className="rounded-lg border p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h3 className="font-semibold">{t(props.titleKey as never)}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(props.descriptionKey as never)}
            </p>
          </div>
          <div className="shrink-0">{props.primaryAction}</div>
        </div>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium">{t('releaseProductionManifestLabel')}</span>
          <select
            className="min-h-11 w-full rounded-md border bg-background px-3 py-2"
            value={props.manifestId}
            onChange={(event) => props.onManifestChange(event.target.value)}
            disabled={props.selectDisabled}
          >
            {props.candidates.length === 0 ? (
              <option value="">{t('releaseProductionNoManifest')}</option>
            ) : null}
            {props.candidates.map((build) => (
              <option key={build.manifest!.id} value={build.manifest!.id}>
                {t('releaseProductionManifestOption', {
                  revision: build.revision,
                  digest: build.manifest!.digest.slice(0, 19),
                })}
              </option>
            ))}
          </select>
        </label>
      </section>
      <StageSummary {...props} />
      {props.dialog}
    </>
  );
}

function ContextStrip(props: {
  currentOnline: string;
  releaseVersion: string;
  orderStatus: string;
  pendingApprovals: number;
  online: boolean;
}) {
  const t = useTranslations('projects');
  const values = [
    [t('releaseContextCurrentOnline'), props.online && props.currentOnline
      ? `${shortDigest(props.currentOnline)} · ${t('releaseContextRunningNormally')}`
      : t('releaseContextNotOnline')],
    [t('releaseContextDelivering'), `${props.releaseVersion} · ${props.orderStatus}`],
    [t('releaseContextTodos'), t('releaseContextTodoCount', { count: props.pendingApprovals })],
    [t('releaseContextReleaseOrder'), `${t('releaseContextStagingFirst')} → ${t('releaseContextProductionLast')}`],
  ];
  return (
    <section className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4" data-context-strip="true">
      {values.map(([label, value]) => <ContextItem key={label} label={label} value={value} />)}
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
    <section className="grid gap-3 sm:grid-cols-3" data-stage-summary="true">
      <SummaryCard label={t('releaseStageSummaryCurrentOnline')} value={
        props.online && props.currentOnline ? shortDigest(props.currentOnline) : t('releaseStageSummaryNotOnline')
      } />
      <SummaryCard label={t('releaseStageSummaryArtifact')} value={
        props.frozenManifest ? shortDigest(props.frozenManifest) : t('releaseStageSummaryNotFrozen')
      } />
      <SummaryCard label={t('releaseStageSummaryPrerequisite')} value={
        props.preflightReady ? t('releaseStageSummaryPrerequisiteReady') : t('releaseStageSummaryPrerequisitePending')
      } />
    </section>
  );
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return <div><span className="text-xs text-muted-foreground">{label}</span><strong className="mt-0.5 block break-all">{value}</strong></div>;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">{label}</span><strong className="mt-1 block break-all text-sm">{value}</strong></div>;
}

function shortDigest(value: string) {
  return value.length > 19 ? `${value.slice(0, 19)}…` : value;
}

export function productionStageCopy(run: ReleaseEvidenceProductionRun | null, online: boolean) {
  if (!run) return copy('releaseStageCalloutProduction', 'releaseProductionDescription');
  const status = run.status.toLowerCase();
  if (status === 'awaiting_validation') {
    return copy('environmentVersionAwaitingValidation', 'environmentVersionManualRequired');
  }
  if (run.operationApproval.status === 'pending') {
    return copy('releaseStageCalloutAwaitingApproval', 'releaseProductionDescription');
  }
  if (status === 'running') return copy('releaseStageCalloutRunning', 'releaseProductionDescription');
  if (['succeeded', 'completed'].includes(status)) {
    return copy('releaseStageCalloutOnlineHealthy', 'releaseStageCalloutOnlineHealthyDetail');
  }
  if (online) return copy('releaseStageCalloutHistoricalOnline', 'releaseStageCalloutHistoricalOnlineDetail');
  if (status === 'failed' || run.operationApproval.status === 'rejected') {
    return copy('releaseStageCalloutFailed', 'releaseStageCalloutFailedDetail');
  }
  return copy('releaseStageCalloutProduction', 'releaseProductionDescription');
}

function copy(titleKey: string, descriptionKey: string) {
  return { titleKey, descriptionKey };
}
