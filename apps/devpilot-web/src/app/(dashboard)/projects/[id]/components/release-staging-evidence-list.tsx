'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button, StatusTag } from '@/components/ui';
import type { ReleaseEvidenceDeploymentRun } from '../types/release-order-evidence.types';
import { formatDuration, formatIso } from '../utils/release-time.utils';
import { releaseOrderStatusTone } from '../utils/release-order.utils';
import { ReleaseDeploymentEvidenceLink } from './release-deployment-evidence-link';

interface Props {
  projectId: string;
  items: ReleaseEvidenceDeploymentRun[];
  total: number;
  focusedRunId?: string;
  onFocus: (runId: string) => void;
}

export function ReleaseStagingEvidenceList(props: Props) {
  const t = useTranslations('projects');
  return (
    <div className="space-y-3">
      {props.total > props.items.length ? (
        <p className="text-xs text-muted-foreground">
          {t('releaseEvidenceHistoryLimited', { shown: props.items.length, total: props.total })}
        </p>
      ) : null}
      {props.items.map((run) => {
        const focused = run.id === props.focusedRunId;
        return (
          <article
            key={run.id}
            className={`rounded-md border p-4 text-sm ${focused ? 'ring-2 ring-primary' : ''}`}
            aria-current={focused ? 'true' : undefined}
            data-deployment-run-id={run.id}
          >
            <div className="flex flex-wrap items-center gap-2">
              <strong>DeploymentRun {run.id}</strong>
              <StatusTag
                status={releaseOrderStatusTone(run.status)}
                label={run.status}
              />
            </div>
            <p className="mt-2 break-all font-mono text-xs">
              BuildRun {run.manifest.buildRun.id} / #{run.manifest.buildRun.revision}
            </p>
            <p className="mt-1 break-all font-mono text-xs">
              Manifest {run.manifest.id} / {run.manifest.digest}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {run.environment.name} · {run.environment.id} ·{' '}
              {formatDuration(run.startedAt, run.finishedAt) || '—'} · {formatIso(run.createdAt)}
            </p>
            {run.error ? <p className="mt-2 text-destructive">{run.error}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => props.onFocus(run.id)}
              >
                {t('releaseEvidenceDetails')}
              </Button>
              <ReleaseDeploymentEvidenceLink
                projectId={props.projectId}
                runId={run.id}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
