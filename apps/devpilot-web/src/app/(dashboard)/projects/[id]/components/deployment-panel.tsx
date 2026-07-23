/** 项目部署运行面板。 */
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { Button, ErrorBanner, StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import { getProjectEnvironmentLabels } from '@/lib/project-display';
import { DeployVarPreview } from './deploy-var-preview';
import { getRunStatusLabelKey, getRunSourceLabelKey, shortSha } from '../utils/run-labels';
import type { DeploymentRun } from '../types/operations';
import type { useProjectDetail } from '../hooks/use-project-detail';
type DetailHook = ReturnType<typeof useProjectDetail>;

const INITIAL_VISIBLE = 10;

export function DeploymentPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const [expanded, setExpanded] = useState(false);

  if (detail.deploymentError) {
    return (
      <ErrorBanner
        message={detail.deploymentError}
        onRetry={() => detail.loadDeploymentRuns()}
      />
    );
  }
  if (detail.deploymentRuns.length === 0) return <EmptyState text={t('noDeploymentRuns')} />;

  const visible = expanded ? detail.deploymentRuns : detail.deploymentRuns.slice(0, INITIAL_VISIBLE);

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold">{t('deploymentRuns')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('deploymentPanelDescription')}</p>
      </div>
      <div className="space-y-2">
        {visible.map((run) => (
          <DeploymentRunRow key={run.id} run={run} t={t} />
        ))}
      </div>
      {detail.deploymentRuns.length > INITIAL_VISIBLE ? (
        <Button
          variant="ghost"
          size="sm"
          block
          className="mt-2"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded
            ? t('collapse')
            : t('showAll', { count: detail.deploymentRuns.length })}
        </Button>
      ) : null}
    </div>
  );
}

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

function DeploymentRunRow({ run, t }: { run: DeploymentRun; t: ProjectsTranslator }) {
  const [open, setOpen] = useState(false);
  const sourceKey = getRunSourceLabelKey(run.source);
  const statusKey = getRunStatusLabelKey(run.status);
  const statusLabel = statusKey ? t(statusKey) : run.status;
  return (
    <div className="rounded-md border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium">
            {t('sourceLabel')}: {sourceKey ? t(sourceKey) : run.source || '-'}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            {t('branchLabel')}: {run.branch || '-'}
          </span>
          {run.environment ? (
            <span className="ml-2 text-xs text-muted-foreground">
              {getProjectEnvironmentLabels({ environments: [run.environment] })[0] ?? run.environment}
            </span>
          ) : null}
          {run.actor?.name ? (
            <span className="ml-2 text-xs text-muted-foreground">{run.actor.name}</span>
          ) : null}
          {shortSha(run.commitSha) ? (
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              {shortSha(run.commitSha)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <StatusTag status={run.status} label={statusLabel} />
          <span className="text-xs text-muted-foreground">{formatDateTimeMinute(run.startedAt)}</span>
          <button
            type="button"
            className="rounded px-1 text-xs text-muted-foreground hover:bg-accent"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={t('runToggleVars')}
          >
            {open ? '▾' : '▸'} {t('runToggleVars')}
          </button>
        </div>
      </div>
      {open ? <DeployVarPreview run={run} t={t} /> : null}
    </div>
  );
}
