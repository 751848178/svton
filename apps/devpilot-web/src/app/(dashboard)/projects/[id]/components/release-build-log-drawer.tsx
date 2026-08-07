'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Drawer, LoadingState } from '@svton/ui';
import { ErrorBanner, StatusTag } from '@/components/ui';
import type { ReleaseBuildItem } from '../types/release-order.types';
import { formatDuration, formatIso } from '../utils/release-time.utils';
import { releaseBuildStatusLabelKey, releaseBuildStatusTone } from './release-build-view.model';
import { ReleaseManifestEvidence } from './release-manifest-evidence';

interface Props {
  run: ReleaseBuildItem | null;
  requestedBuildRunId?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onClose: () => void;
}

export function ReleaseBuildLogDrawer({
  run,
  requestedBuildRunId,
  loading,
  error,
  onRetry,
  onClose,
}: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const summary = logSummary(run?.logSummary);

  return (
    <Drawer
      open={Boolean(run || requestedBuildRunId)}
      onClose={onClose}
      title={run ? t('releaseBuildLogTitle', { revision: run.revision }) : t('releaseBuildLogs')}
      width="min(720px, 100vw)"
      ariaCloseLabel={tc('close')}
    >
      {loading ? <LoadingState text={t('releaseBuildDetailLoading')} /> : null}
      {error ? (
        <ErrorBanner
          message={error}
          onRetry={onRetry}
        />
      ) : null}
      {run ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusTag
              status={releaseBuildStatusTone(run.status)}
              label={t(releaseBuildStatusLabelKey(run.status))}
            />
            <span className="text-xs text-muted-foreground">
              {t('releaseBuildDuration')}: {formatDuration(run.startedAt, run.finishedAt) || '—'}
            </span>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Evidence
              label={t('releaseBuildId')}
              value={run.id}
            />
            <Evidence
              label={t('releaseBuildRevisionLabel')}
              value={String(run.revision)}
            />
            <Evidence
              label={t('releaseBuildCommit')}
              value={run.sourceCommitSha}
            />
            <Evidence
              label={t('releaseBuildSourceBranch')}
              value={run.sourceBranch}
            />
            {run.sourceRepository ? (
              <>
                <Evidence
                  label={t('releaseBuildSourceProvider')}
                  value={run.sourceRepository.provider}
                />
                <Evidence
                  label={t('releaseBuildSourceRevision')}
                  value={`R${run.sourceRepository.identityRevision}`}
                />
                <Evidence
                  label={t('releaseBuildSourceRepository')}
                  value={run.sourceRepository.canonicalUrl}
                />
              </>
            ) : null}
            <Evidence
              label={t('releaseBuildLogReference')}
              value={run.logReference || '—'}
            />
            <Evidence
              label={t('releaseBuildCreatedAt')}
              value={formatIso(run.createdAt)}
            />
            <Evidence
              label={t('releaseBuildStartedAt')}
              value={formatIso(run.startedAt)}
            />
            <Evidence
              label={t('releaseBuildFinishedAt')}
              value={formatIso(run.finishedAt)}
            />
            <Evidence
              label={t('releaseBuildManifestId')}
              value={run.manifest?.id || '—'}
            />
            <Evidence
              label={t('releaseBuildManifestDigest')}
              value={run.manifest?.digest || '—'}
            />
          </dl>
          <ReleaseManifestEvidence manifest={run.manifest} />
          {run.errorCode ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {run.errorCode}: {run.errorMessage || t('releaseBuildUnavailable')}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {summary.redacted ? t('releaseBuildLogsRedacted') : t('releaseBuildLogsUnavailable')}
          </p>
          {summary.truncated ? (
            <p className="text-xs text-muted-foreground">
              {t('releaseBuildLogsTruncated', {
                shown: summary.lineCount,
                total: summary.sourceLineCount,
              })}
            </p>
          ) : null}
          <pre
            className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-xs"
            role="log"
            aria-label={t('releaseBuildLogTitle', { revision: run.revision })}
          >
            {summary.lines.length ? summary.lines.join('\n') : t('releaseBuildLogsEmpty')}
          </pre>
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

function logSummary(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      redacted: false,
      truncated: false,
      lineCount: 0,
      sourceLineCount: 0,
      lines: [] as string[],
    };
  }
  const summary = value as Record<string, unknown>;
  const redacted = summary.redacted === true;
  const lines =
    redacted && Array.isArray(summary.lines)
      ? summary.lines.filter((line): line is string => typeof line === 'string')
      : [];
  return {
    redacted,
    truncated: redacted && summary.truncated === true,
    lineCount: lines.length,
    sourceLineCount:
      redacted && typeof summary.sourceLineCount === 'number'
        ? summary.sourceLineCount
        : lines.length,
    lines,
  };
}
