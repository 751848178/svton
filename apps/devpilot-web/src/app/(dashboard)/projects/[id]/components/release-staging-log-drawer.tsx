'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Drawer, LoadingState } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { FlowStatusTag } from './release-workbench/release-flow-status-tag';
import type { ReleaseBuildItem, ReleaseStagingDeploymentItem } from '../types/release-order.types';
import { releaseRunStatusLabelKey } from '../utils/release-copy.model';
import {
  stagingBusinessConclusion,
  stagingTechnicalConclusion,
} from '../utils/release-staging-view.model';
import { formatDuration, formatIso } from '../utils/release-time.utils';
import {
  providerKeyLabel,
  shortDigest,
  shortTechnicalId,
} from '../utils/release-display.utils';
import { releaseOrderStatusTone } from '../utils/release-order.utils';
import { ReleaseDeploymentEvidenceLink } from './release-deployment-evidence-link';
import { ReleaseStagingTechnicalEvidence } from './release-staging-technical-evidence';

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

/**
 * PX-3：标题与字段值短 ID 化（完整值进 title/原始证据）。
 * PX-11：耗时分隔符统一「·」。
 * PX-31：技术部署证据改结构化 + raw JSON 折叠。
 */
export function ReleaseStagingLogDrawer(props: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const technical = props.run ? stagingTechnicalConclusion(props.run) : null;
  const business = props.run ? stagingBusinessConclusion(props.run) : null;
  const runId = props.run?.id || props.requestedRunId || '—';
  return (
    <Drawer
      open={Boolean(props.run || props.requestedRunId)}
      onClose={props.onClose}
      title={t('releaseStagingLogTitle', { id: shortTechnicalId(runId) })}
      width="min(720px, 100vw)"
      ariaCloseLabel={tc('close')}
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
            <FlowStatusTag
              status={releaseOrderStatusTone(props.run.status)}
              label={t(releaseRunStatusLabelKey(props.run.status))}
            />
            <span className="text-xs text-muted-foreground">
              {t('releaseBuildDuration')} ·{' '}
              {formatDuration(props.run.startedAt, props.run.finishedAt) ||
                t('releaseWorkbenchValueEmpty')}
            </span>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Evidence
              label={t('releaseStagingDeploymentRunId')}
              value={shortTechnicalId(props.run.id)}
              title={props.run.id}
            />
            <Evidence
              label={t('releaseBuildId')}
              value={props.build ? shortTechnicalId(props.build.id) : t('releaseStagingBuildUnavailable')}
              title={props.build?.id}
            />
            <Evidence
              label={t('releaseBuildRevisionLabel')}
              value={props.build ? String(props.build.revision) : '—'}
            />
            <Evidence
              label={t('releaseBuildManifestDigest')}
              value={shortDigest(props.build?.manifest?.digest)}
              title={props.build?.manifest?.digest}
            />
            <Evidence
              label={t('releaseStagingProvider')}
              value={`${providerKeyLabel(props.run.executorKey)} / ${providerKeyLabel(props.run.adapterKey)}`}
              title={`${props.run.executorKey || '—'} / ${props.run.adapterKey || '—'}`}
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
          <ReleaseStagingTechnicalEvidence result={props.run.result} />
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

function Evidence({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className="break-all font-mono"
        title={title}
      >
        {value}
      </dd>
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
        <FlowStatusTag
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
