/** 项目部署运行面板。 */
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { Button, ErrorBanner, StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import { getProjectEnvironmentLabels } from '@/lib/project-display';
import { DeployVarPreview } from './deploy-var-preview';
import { DeployServiceSection } from './deploy-service-section';
import { PanelGroup } from './panel-group';
import { BranchIcon, SourceIcon } from './panel-icons';
import { getRunStatusLabelKey, getRunSourceLabelKey, shortSha } from '../utils/run-labels';
import type { DeploymentRun } from '../types/operations';
import type { ProjectApplication, ProjectService } from '../types';
import type { useProjectDetail } from '../hooks/use-project-detail';
type DetailHook = ReturnType<typeof useProjectDetail>;

const INITIAL_VISIBLE = 10;

interface DeploymentPanelProps {
  detail: DetailHook;
  /** 打开内联部署向导（项目域 app/service）。无值时回退到运行历史视图。 */
  onOpenDeploy?: (application: ProjectApplication, service: ProjectService) => void;
}

export function DeploymentPanel({ detail, onOpenDeploy }: DeploymentPanelProps) {
  const t = useTranslations('projects');
  const [expanded, setExpanded] = useState(false);

  const showDeploySection = Boolean(onOpenDeploy && detail.project?.applications?.length);

  const runsPanel = (
    <PanelGroup title={t('deploymentRuns')} subtitle={t('deploymentPanelDescription')}>
      {detail.deploymentError ? (
        <ErrorBanner
          message={detail.deploymentError}
          onRetry={() => detail.loadDeploymentRuns()}
        />
      ) : detail.deploymentRuns.length === 0 ? (
        <EmptyState text={t('noDeploymentRuns')} />
      ) : (
        <DeploymentRunList
          runs={detail.deploymentRuns}
          visibleCount={INITIAL_VISIBLE}
          expanded={expanded}
          onToggle={setExpanded}
          t={t}
        />
      )}
    </PanelGroup>
  );

  if (!showDeploySection) return runsPanel;

  return (
    <div className="space-y-4">
      <DeployServiceSection
        applications={detail.project!.applications!}
        onOpenDeploy={onOpenDeploy!}
      />
      {runsPanel}
    </div>
  );
}

function DeploymentRunList({
  runs,
  visibleCount,
  expanded,
  onToggle,
  t,
}: {
  runs: DeploymentRun[];
  visibleCount: number;
  expanded: boolean;
  onToggle: (v: boolean) => void;
  t: ReturnType<typeof useTranslations<'projects'>>;
}) {
  const visible = expanded ? runs : runs.slice(0, visibleCount);
  return (
    <>
      <div className="space-y-2">
        {visible.map((run) => (
          <DeploymentRunRow key={run.id} run={run} t={t} />
        ))}
      </div>
      {runs.length > visibleCount ? (
        <Button
          variant="ghost"
          size="sm"
          block
          className="mt-2"
          onClick={() => onToggle(!expanded)}
        >
          {expanded ? t('collapse') : t('showAll', { count: runs.length })}
        </Button>
      ) : null}
    </>
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
          <span className="inline-flex items-center gap-1 font-medium">
            <SourceIcon className="h-3.5 w-3.5" />
            {t('sourceLabel')}: {sourceKey ? t(sourceKey) : run.source || '-'}
          </span>
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <BranchIcon className="h-3.5 w-3.5" />
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
