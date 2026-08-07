'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Drawer, LoadingState } from '@svton/ui';
import { ErrorBanner, StatusTag } from '@/components/ui';
import type {
  ReleaseEvidenceDeploymentRun,
  ReleaseEvidenceProductionRun,
} from '../types/release-order-evidence.types';
import { releaseRunStatusLabelKey } from '../utils/release-copy.model';
import {
  productionBusinessConclusion,
  productionTechnicalConclusion,
} from '../utils/release-production-evidence.model';
import { formatDuration, formatIso } from '../utils/release-time.utils';
import { releaseRunStateTone } from '../utils/release-order.utils';
import { ReleaseDeploymentEvidenceLink } from './release-deployment-evidence-link';
import { ReleaseSiteProbeEvidence } from './release-site-probe-evidence';

const MAX_RAW_LENGTH = 12_000;

interface Props {
  projectId: string;
  run: ReleaseEvidenceDeploymentRun | null;
  releaseRun: ReleaseEvidenceProductionRun | null;
  requestedRunId?: string;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onClose: () => void;
}

export function ReleaseProductionLogDrawer(props: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const technical = props.run ? productionTechnicalConclusion(props.run) : null;
  const business = props.run ? productionBusinessConclusion(props.run) : null;
  return (
    <Drawer
      open={Boolean(props.run || props.requestedRunId)}
      onClose={props.onClose}
      title={t('releaseProductionLogTitle', { id: props.run?.id || props.requestedRunId || '—' })}
      width="min(760px, 100vw)"
      ariaCloseLabel={tc('close')}
    >
      {props.loading ? <LoadingState text={t('releaseProductionDetailLoading')} /> : null}
      {props.error ? (
        <ErrorBanner
          message={props.error}
          onRetry={props.onRetry}
        />
      ) : null}
      {props.run ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusTag
              status={releaseRunStateTone(props.run.status)}
              label={t(releaseRunStatusLabelKey(props.run.status))}
            />
            <span className="text-xs text-muted-foreground">
              {t('releaseBuildDuration')}:{' '}
              {formatDuration(props.run.startedAt, props.run.finishedAt) || '—'}
            </span>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Evidence
              label={t('releaseProductionDeploymentRunId')}
              value={props.run.id}
            />
            <Evidence
              label={t('releaseProductionReleaseRunId')}
              value={props.releaseRun?.id || '—'}
            />
            <Evidence
              label={t('releaseBuildManifestId')}
              value={props.run.artifactManifestId || '—'}
            />
            <Evidence
              label={t('releaseBuildManifestDigest')}
              value={props.run.manifest?.digest || '—'}
            />
            <Evidence
              label={t('releaseStagingProvider')}
              value={`${props.run.executorKey || '—'} / ${props.run.adapterKey || '—'}`}
            />
            <Evidence
              label={t('releaseBuildStartedAt')}
              value={formatIso(props.run.startedAt)}
            />
            <Evidence
              label={t('releaseBuildFinishedAt')}
              value={formatIso(props.run.finishedAt)}
            />
          </dl>
          <div className="grid gap-3 sm:grid-cols-2">
            <ConclusionCard
              title={t('releaseStagingTechnicalResult')}
              conclusion={technical!}
              detail={t('releaseProductionTechnicalResultDetail')}
            />
            <ConclusionCard
              title={t('releaseStagingBusinessResult')}
              conclusion={business!}
              detail={t('releaseProductionBusinessResultDetail')}
            />
          </div>
          {props.run.error ? (
            <RawEvidence
              title={t('releaseStagingErrorEvidence')}
              value={props.run.error}
              danger
            />
          ) : null}
          <RawEvidence
            title={t('releaseStagingTechnicalEvidence')}
            value={props.run.result}
            empty={t('releaseProductionEvidenceUnavailable')}
          />
          <RawEvidence
            title={t('releaseStagingExecutionLogs')}
            value={props.run.logs}
            empty={t('releaseProductionLogsEmpty')}
            role="log"
          />
          <ReleaseSiteProbeEvidence
            projectId={props.projectId}
            siteProbe={props.run.siteProbe}
            routeSwitch={props.run.routeSwitch}
          />
          <ReleaseDeploymentEvidenceLink
            projectId={props.projectId}
            runId={props.run.id}
          />
        </div>
      ) : null}
    </Drawer>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all font-mono">{value}</dd>
    </div>
  );
}

function ConclusionCard(props: {
  title: string;
  conclusion: ReturnType<typeof productionTechnicalConclusion>;
  detail: string;
}) {
  const t = useTranslations('projects');
  return (
    <section className="rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{props.title}</h4>
        <StatusTag
          status={props.conclusion.tone}
          label={t(props.conclusion.key)}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{props.detail}</p>
    </section>
  );
}

function RawEvidence(props: {
  title: string;
  value: unknown;
  empty?: string;
  danger?: boolean;
  role?: 'log';
}) {
  const content = display(props.value, props.empty || '—');
  return (
    <section className={`rounded-md border p-3 ${props.danger ? 'border-destructive/40' : ''}`}>
      <h4 className="text-sm font-medium">{props.title}</h4>
      <pre
        className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 font-mono text-xs"
        role={props.role}
      >
        {content}
      </pre>
    </section>
  );
}

function display(value: unknown, empty: string) {
  const raw = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').join('\n')
    : typeof value === 'string'
      ? value
      : value && typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : '';
  if (!raw) return empty;
  return raw.length > MAX_RAW_LENGTH ? `${raw.slice(0, MAX_RAW_LENGTH)}\n…` : raw;
}
