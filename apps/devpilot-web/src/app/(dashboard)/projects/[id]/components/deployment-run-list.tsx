'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button, StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { DeploymentRun } from '../types/operations';
import { deploymentRunHref } from '../utils/project-route.utils';
import { releaseEnvironmentValueLabelKey } from '../utils/release-copy.model';
import { getRunStatusLabelKey, getRunSourceLabelKey, shortSha } from '../utils/run-labels';
import { DeploymentRunDetails } from './deployment-run-details.component';
import { BranchIcon, SourceIcon } from './panel-icons';

export function DeploymentRunList(props: {
  projectId: string;
  runs: DeploymentRun[];
  visibleCount: number;
  expanded: boolean;
  onToggle: (value: boolean) => void;
  focusedRunId?: string;
}) {
  const t = useTranslations('projects');
  const visible = props.expanded ? props.runs : props.runs.slice(0, props.visibleCount);
  return (
    <>
      <div className="space-y-2">
        {visible.map((run) => (
          <DeploymentRunRow
            key={run.id}
            projectId={props.projectId}
            run={run}
            initiallyOpen={run.id === props.focusedRunId}
          />
        ))}
      </div>
      {props.runs.length > props.visibleCount ? (
        <Button
          variant="ghost"
          size="sm"
          block
          className="mt-2"
          onClick={() => props.onToggle(!props.expanded)}
        >
          {props.expanded ? t('collapse') : t('showAll', { count: props.runs.length })}
        </Button>
      ) : null}
    </>
  );
}

function DeploymentRunRow(props: {
  projectId: string;
  run: DeploymentRun;
  initiallyOpen: boolean;
}) {
  const t = useTranslations('projects');
  const [open, setOpen] = useState(props.initiallyOpen);
  const run = props.run;
  const sourceKey = getRunSourceLabelKey(run.source);
  const environmentKey = releaseEnvironmentValueLabelKey(run.environment);
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
              {environmentKey ? t(environmentKey) : run.environment}
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
          {/* DEP-7：失败原因在列表行直接可见，不再埋进三级折叠。 */}
          {run.status === 'failed' && run.error ? (
            <span
              className="ml-2 max-w-[24rem] truncate text-xs text-destructive"
              title={run.error}
            >
              {run.error}
            </span>
          ) : null}
          {releaseStage ? (
            <Link
              className="ml-2 text-xs text-primary hover:underline"
              href={`?tab=releases&releasePlanId=${encodeURIComponent(
                releaseStage.releasePlan.id,
              )}&stageId=${encodeURIComponent(releaseStage.id)}`}
            >
              {t('releaseRunLink', { name: releaseStage.releasePlan.name })}
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link
            className="text-xs font-medium text-primary hover:underline"
            href={deploymentRunHref(
              props.projectId,
              run.id,
              // 归属链优先级与 API 一致：manifest 链（可靠）优先，plan 链兜底。
              run.artifactManifest?.releaseOrderId ??
                run.releaseStageAttempts?.[0]?.releaseStage.releasePlan.releaseOrderId ??
                undefined,
            )}
          >
            {t('viewDeploymentRecord')}
          </Link>
          <StatusTag
            status={run.status}
            label={t(getRunStatusLabelKey(run.status))}
          />
          <span className="text-xs text-muted-foreground">
            {formatDateTimeMinute(run.startedAt)}
          </span>
          <button
            type="button"
            className="rounded px-1 text-xs text-muted-foreground hover:bg-accent"
            onClick={() => setOpen((value) => !value)}
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
