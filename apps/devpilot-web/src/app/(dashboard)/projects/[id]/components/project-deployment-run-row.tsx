'use client';

import React from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type { DeploymentRun } from '../types/operations';
import { getRunStatusLabelKey } from '../utils/run-labels';

export function ProjectDeploymentRunRow(props: {
  run: DeploymentRun;
  versionLabel: string;
  stage?: string;
  onSelect: (trigger: HTMLButtonElement) => void;
}) {
  const t = useTranslations('projects');
  const { run } = props;
  return (
    <tr>
      <td>
        <button
          type="button"
          data-deployment-run-trigger={`${run.id}:run`}
          className="min-h-11 font-mono text-xs font-medium text-primary hover:underline"
          onClick={(event) => props.onSelect(event.currentTarget)}
        >
          {shortId(run.id)}
        </button>
      </td>
      <td>
        <p>{props.versionLabel}</p>
        {props.stage ? <p className="text-xs text-muted-foreground">{props.stage}</p> : null}
      </td>
      <td>{run.projectEnvironment?.name ?? run.environment ?? '—'}</td>
      <td>
        <StatusTag
          status={run.status}
          label={t(getRunStatusLabelKey(run.status))}
        />
        <p className="mt-1 max-w-64 truncate text-xs text-muted-foreground">
          {run.error || executionProgress(run, t('deploymentProgressNoTrace'))}
        </p>
      </td>
      <td className="font-mono text-xs">{duration(run, t('deploymentDurationRunning'))}</td>
      <td>{run.actor?.name ?? run.actor?.email ?? t('deploymentActorSystem')}</td>
      <td className="text-right">
        <button
          type="button"
          data-deployment-run-trigger={`${run.id}:evidence`}
          className="inline-flex min-h-11 items-center gap-1 font-medium text-primary hover:underline"
          onClick={(event) => props.onSelect(event.currentTarget)}
        >
          {t('deploymentViewEvidence')}
          <ArrowRight
            size={14}
            aria-hidden="true"
          />
        </button>
      </td>
    </tr>
  );
}

function executionProgress(run: DeploymentRun, noTrace: string) {
  const job = run.serverExecutionJob;
  return job ? `${job.status} · ${job.attempt}/${job.maxAttempts}` : noTrace;
}

function duration(run: DeploymentRun, runningLabel: string) {
  if (!run.finishedAt) return runningLabel;
  const milliseconds = Date.parse(run.finishedAt) - Date.parse(run.startedAt);
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '—';
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function shortId(value: string) {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}
