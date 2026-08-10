'use client';

import React, { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button, StatusTag } from '@/components/ui';
import type { ReleaseBuildItem, ReleaseStagingDeploymentItem } from '../types/release-order.types';
import { releaseRunStatusLabelKey } from '../utils/release-copy.model';
import {
  stagingBuildForRun,
  stagingBusinessConclusion,
  stagingTechnicalConclusion,
} from '../utils/release-staging-view.model';
import { formatDuration, formatIso } from '../utils/release-time.utils';
import { releaseOrderStatusTone } from '../utils/release-order.utils';
import { ReleaseDeploymentEvidenceLink } from './release-deployment-evidence-link';

interface Props {
  items: ReleaseStagingDeploymentItem[];
  builds: ReleaseBuildItem[];
  total: number;
  focusedRunId?: string;
  deploying: boolean;
  onOpenLog: (runId: string) => void;
  onDeploy: (manifestId: string) => void;
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
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[980px] table-fixed text-sm">
          <caption className="sr-only">{t('releaseStagingHistoryTable')}</caption>
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[25%]" />
            <col className="w-[14%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[11%]" />
          </colgroup>
          <thead className="bg-muted/50 text-left">
            <tr>
              <Header>{t('releaseStagingColumnRun')}</Header>
              <Header>{t('releaseStagingColumnArtifact')}</Header>
              <Header>{t('releaseStagingColumnResult')}</Header>
              <Header>{t('releaseStagingColumnVerification')}</Header>
              <Header>{t('releaseBuildColumnDurationTime')}</Header>
              <Header>{t('releaseBuildColumnActions')}</Header>
            </tr>
          </thead>
          <tbody className="divide-y">
            {props.items.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                build={stagingBuildForRun(run, props.builds)}
                focused={run.id === props.focusedRunId}
                deploying={props.deploying}
                onOpenLog={props.onOpenLog}
                onDeploy={props.onDeploy}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RunRow(props: {
  run: ReleaseStagingDeploymentItem;
  build: ReleaseBuildItem | null;
  focused: boolean;
  deploying: boolean;
  onOpenLog: (runId: string) => void;
  onDeploy: (manifestId: string) => void;
}) {
  const t = useTranslations('projects');
  const technical = stagingTechnicalConclusion(props.run);
  const business = stagingBusinessConclusion(props.run);
  const manifestId = props.run.artifactManifestId || props.build?.manifest?.id || '';
  return (
    <tr
      className={props.focused ? 'bg-primary/5' : undefined}
      aria-current={props.focused ? 'true' : undefined}
      data-deployment-run-id={props.run.id}
    >
      <RowHeader>
        <code className="block break-all font-semibold">DeploymentRun {props.run.id}</code>
        <span className="mt-1 block text-xs text-muted-foreground">
          {props.run.adapterKey || props.run.executorKey}
        </span>
      </RowHeader>
      <Cell>
        <strong className="block">
          {props.build
            ? `BuildRun ${props.build.id} · R${props.build.revision}`
            : t('releaseStagingBuildUnavailable')}
        </strong>
        <code className="mt-1 block break-all text-xs">Manifest {manifestId || '—'}</code>
        {props.build?.manifest?.digest ? (
          <code className="block truncate text-xs text-muted-foreground">
            {props.build.manifest.digest}
          </code>
        ) : null}
      </Cell>
      <Cell>
        <StatusTag
          status={releaseOrderStatusTone(props.run.status)}
          label={t(releaseRunStatusLabelKey(props.run.status))}
        />
        {props.run.error ? (
          <span className="mt-1 block line-clamp-2 text-xs text-red-700">
            {props.run.error}
          </span>
        ) : null}
      </Cell>
      <Cell>
        <Conclusion
          label={t('releaseStagingTechnicalResult')}
          conclusion={technical}
        />
        <Conclusion
          label={t('releaseStagingBusinessResult')}
          conclusion={business}
        />
      </Cell>
      <Cell>
        <span className="block">
          {formatDuration(props.run.startedAt, props.run.finishedAt) || '—'}
        </span>
        <time
          className="block text-xs text-muted-foreground"
          dateTime={props.run.createdAt}
        >
          {formatIso(props.run.createdAt)}
        </time>
      </Cell>
      <Cell>
        <div className="flex flex-col items-start gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-label={t('viewReleaseStagingLogsForRun', { id: props.run.id })}
            onClick={() => props.onOpenLog(props.run.id)}
          >
            {t('viewReleaseStagingLogs')}
          </Button>
          <Button
            size="sm"
            aria-label={t('deployExactManifestForRun', { runId: props.run.id, manifestId })}
            disabled={!manifestId || props.deploying}
            onClick={() => props.onDeploy(manifestId)}
          >
            {t('deployExactManifest')}
          </Button>
          <ReleaseDeploymentEvidenceLink
            projectId={props.run.projectId}
            runId={props.run.id}
          />
        </div>
      </Cell>
    </tr>
  );
}

function Conclusion(props: {
  label: string;
  conclusion: ReturnType<typeof stagingTechnicalConclusion>;
}) {
  const t = useTranslations('projects');
  return (
    <div className="mb-1 flex flex-wrap items-center gap-1 last:mb-0">
      <span className="text-xs text-muted-foreground">{props.label}</span>
      <StatusTag
        status={props.conclusion.tone}
        label={t(props.conclusion.key)}
      />
    </div>
  );
}

function Header({ children }: { children: ReactNode }) {
  return <th scope="col" className="px-4 py-3 font-medium">{children}</th>;
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function RowHeader({ children }: { children: ReactNode }) {
  return <th scope="row" className="px-4 py-3 text-left align-top font-normal">{children}</th>;
}
