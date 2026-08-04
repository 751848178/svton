'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Drawer } from '@svton/ui';
import type { ReleaseBuildItem } from '../types/release-order.types';

interface Props {
  run: ReleaseBuildItem | null;
  onClose: () => void;
}

export function ReleaseBuildLogDrawer({ run, onClose }: Props) {
  const t = useTranslations('projects');
  const summary = logSummary(run?.logSummary);

  return (
    <Drawer
      open={Boolean(run)}
      onClose={onClose}
      title={run ? t('releaseBuildLogTitle', { revision: run.revision }) : t('releaseBuildLogs')}
      width={720}
    >
      {run ? (
        <div className="space-y-4">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
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
          </dl>
          <p className="text-xs text-muted-foreground">
            {summary.redacted ? t('releaseBuildLogsRedacted') : t('releaseBuildLogsUnavailable')}
          </p>
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
    return { redacted: false, lines: [] as string[] };
  }
  const summary = value as Record<string, unknown>;
  return {
    redacted: summary.redacted === true,
    lines: Array.isArray(summary.lines)
      ? summary.lines.filter((line): line is string => typeof line === 'string')
      : [],
  };
}
