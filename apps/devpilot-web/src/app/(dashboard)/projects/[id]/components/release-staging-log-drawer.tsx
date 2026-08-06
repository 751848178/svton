'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Drawer, LoadingState } from '@svton/ui';
import { ErrorBanner, StatusTag } from '@/components/ui';
import type { ReleaseBuildItem, ReleaseStagingDeploymentItem } from '../types/release-order.types';
import { releaseRunStatusLabelKey } from '../utils/release-copy.model';
import {
  stagingBusinessConclusion,
  stagingTechnicalConclusion,
} from '../utils/release-staging-view.model';
import { formatDuration, formatIso } from '../utils/release-time.utils';
import { releaseOrderStatusTone } from '../utils/release-order.utils';
import { ReleaseDeploymentEvidenceLink } from './release-deployment-evidence-link';

const MAX_RAW_LENGTH = 12_000;

interface Props {
  projectId: string;
  run: ReleaseStagingDeploymentItem | null;
  build: ReleaseBuildItem | null;
  requestedRunId?: string;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onClose: () => void;
}

export function ReleaseStagingLogDrawer(props: Props) {
  const t = useTranslations('projects');
  const technical = props.run ? stagingTechnicalConclusion(props.run) : null;
  const business = props.run ? stagingBusinessConclusion(props.run) : null;
  return (
    <Drawer
      open={Boolean(props.run || props.requestedRunId)}
      onClose={props.onClose}
      title={t('releaseStagingLogTitle', { id: props.run?.id || props.requestedRunId || '—' })}
      width="min(760px, 100vw)"
    >
      {props.loading ? <LoadingState text={t('releaseStagingDetailLoading')} /> : null}
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
              status={releaseOrderStatusTone(props.run.status)}
              label={t(releaseRunStatusLabelKey(props.run.status))}
            />
            <span className="text-xs text-muted-foreground">
              {t('releaseBuildDuration')}:{' '}
              {formatDuration(props.run.startedAt, props.run.finishedAt) || '—'}
            </span>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Evidence
              label={t('releaseStagingDeploymentRunId')}
              value={props.run.id}
            />
            <Evidence
              label={t('releaseBuildId')}
              value={props.build?.id || t('releaseStagingBuildUnavailable')}
            />
            <Evidence
              label={t('releaseBuildRevisionLabel')}
              value={props.build ? String(props.build.revision) : '—'}
            />
            <Evidence
              label={t('releaseBuildManifestId')}
              value={props.run.artifactManifestId || '—'}
            />
            <Evidence
              label={t('releaseBuildManifestDigest')}
              value={props.build?.manifest?.digest || '—'}
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
              detail={t('releaseStagingTechnicalResultDetail')}
            />
            <ConclusionCard
              title={t('releaseStagingBusinessResult')}
              conclusion={business!}
              detail={t('releaseStagingBusinessResultDetail')}
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
            empty={t('releaseStagingEvidenceUnavailable')}
          />
          <RawEvidence
            title={t('releaseStagingExecutionLogs')}
            value={props.run.logs}
            empty={t('releaseStagingLogsEmpty')}
            role="log"
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
  conclusion: ReturnType<typeof stagingTechnicalConclusion>;
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
