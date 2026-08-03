/** 项目部署运行面板。 */
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { Alert, Button, ErrorBanner, StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import { getProjectEnvironmentLabels } from '@/lib/project-display';
import { DeploymentRunDetails } from './deployment-run-details.component';
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
  focusedRunId?: string;
  /** 打开内联部署向导（项目域 app/service）。无值时回退到运行历史视图。 */
  onOpenDeploy?: (application: ProjectApplication, service: ProjectService) => void;
}

export function DeploymentPanel({ detail, focusedRunId, onOpenDeploy }: DeploymentPanelProps) {
  const t = useTranslations('projects');
  const [expanded, setExpanded] = useState(false);

  const showDeploySection = Boolean(onOpenDeploy && detail.project?.applications?.length);

  const focusedRuns = focusedRunId
    ? detail.deploymentRuns.filter((run) => run.id === focusedRunId)
    : detail.deploymentRuns;
  const runsPanel = (
    <PanelGroup
      title={t('deploymentRuns')}
      subtitle={t('deploymentPanelDescription')}
    >
      {focusedRunId ? (
        <Alert tone="info">{t('focusedDeploymentRun', { id: focusedRunId.slice(-8) })}</Alert>
      ) : null}
      {detail.deploymentError ? (
        <ErrorBanner
          message={detail.deploymentError}
          onRetry={() => detail.loadDeploymentRuns()}
        />
      ) : focusedRuns.length === 0 ? (
        <EmptyState
          text={focusedRunId ? t('focusedDeploymentRunNotFound') : t('noDeploymentRuns')}
        />
      ) : (
        <DeploymentRunList
          runs={focusedRuns}
          visibleCount={INITIAL_VISIBLE}
          expanded={Boolean(focusedRunId) || expanded}
          focusedRunId={focusedRunId}
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
  focusedRunId,
  t,
}: {
  runs: DeploymentRun[];
  visibleCount: number;
  expanded: boolean;
  onToggle: (v: boolean) => void;
  focusedRunId?: string;
  t: ReturnType<typeof useTranslations<'projects'>>;
}) {
  const visible = expanded ? runs : runs.slice(0, visibleCount);
  return (
    <>
      <div className="space-y-2">
        {visible.map((run) => (
          <DeploymentRunRow
            key={run.id}
            run={run}
            initiallyOpen={run.id === focusedRunId}
            t={t}
          />
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

function DeploymentRunRow({
  run,
  initiallyOpen,
  t,
}: {
  run: DeploymentRun;
  initiallyOpen: boolean;
  t: ProjectsTranslator;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const sourceKey = getRunSourceLabelKey(run.source);
  const statusKey = getRunStatusLabelKey(run.status);
  const statusLabel = statusKey ? t(statusKey) : run.status;
  const releaseStage = run.releaseStageAttempts?.[0]?.releaseStage;
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
              {getProjectEnvironmentLabels({ environments: [run.environment] })[0] ??
                run.environment}
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
          {releaseStage && (
            <Link
              className="ml-2 text-xs text-primary hover:underline"
              href={`?tab=releases&releasePlanId=${encodeURIComponent(
                releaseStage.releasePlan.id,
              )}&stageId=${encodeURIComponent(releaseStage.id)}`}
            >
              发布：{releaseStage.releasePlan.name}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusTag
            status={run.status}
            label={statusLabel}
          />
          <span className="text-xs text-muted-foreground">
            {formatDateTimeMinute(run.startedAt)}
          </span>
          <button
            type="button"
            className="rounded px-1 text-xs text-muted-foreground hover:bg-accent"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={t('runToggleEvidence')}
          >
            {open ? '▾' : '▸'} {t('runToggleEvidence')}
          </button>
        </div>
      </div>
      {open ? <DeploymentRunDetails run={run} /> : null}
    </div>
  );
}
