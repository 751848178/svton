'use client';

import React, { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button, LinkButton, StatusTag } from '@/components/ui';
import type { ReleaseEvidenceProductionRun } from '../types/release-order-evidence.types';
import {
  releaseApprovalStatusLabelKey,
  releaseEnvironmentLabelKey,
  releaseRunStatusLabelKey,
} from '../utils/release-copy.model';
import { formatDuration, formatIso } from '../utils/release-time.utils';
import { releaseApprovalStateTone, releaseRunStateTone } from '../utils/release-order.utils';
import { ReleaseDeploymentEvidenceLink } from './release-deployment-evidence-link';
import {
  productionBusinessConclusion,
  productionTechnicalConclusion,
} from '../utils/release-production-evidence.model';
import { ReleaseSiteProbeEvidence } from './release-site-probe-evidence';

interface Props {
  projectId: string;
  items: ReleaseEvidenceProductionRun[];
  total: number;
  focusedReleaseRunId?: string;
  focusedDeploymentRunId?: string;
  recoveryHref: string;
  onFocus: (releaseRunId: string, deploymentRunId?: string) => void;
  onOpenLog: (deploymentRunId: string) => void;
}

export function ReleaseProductionEvidenceList(props: Props) {
  const t = useTranslations('projects');
  const deployments = props.items.flatMap((run) =>
    run.deploymentRuns.map((deployment) => ({ run, deployment })),
  );
  const focused = props.items.find((run) => run.id === props.focusedReleaseRunId);
  const focusedDeployment = focused?.deploymentRuns.find(
    (deployment) => deployment.id === props.focusedDeploymentRunId,
  );
  return (
    <div className="space-y-3">
      {props.total > props.items.length ? (
        <p className="text-xs text-muted-foreground">
          {t('releaseEvidenceHistoryLimited', { shown: props.items.length, total: props.total })}
        </p>
      ) : null}
      <div className="space-y-2">
        {props.items.map((run) => (
          <ReleaseRunCard
            key={run.id}
            run={run}
            focused={run.id === props.focusedReleaseRunId}
            recoveryHref={props.recoveryHref}
            onFocus={props.onFocus}
          />
        ))}
      </div>
      {deployments.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[1020px] table-fixed text-sm">
            <caption className="sr-only">{t('releaseProductionHistoryTable')}</caption>
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[24%]" />
              <col className="w-[14%]" />
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="bg-muted/50 text-left">
              <tr>
                <Header>{t('releaseProductionColumnRun')}</Header>
                <Header>{t('releaseProductionColumnArtifact')}</Header>
                <Header>{t('releaseProductionColumnResult')}</Header>
                <Header>{t('releaseProductionColumnVerification')}</Header>
                <Header>{t('releaseBuildColumnDurationTime')}</Header>
                <Header>{t('releaseBuildColumnActions')}</Header>
              </tr>
            </thead>
            <tbody className="divide-y">
              {deployments.map(({ run, deployment }) => (
                <DeploymentRow
                  key={deployment.id}
                  run={deployment}
                  releaseRun={run}
                  focused={deployment.id === props.focusedDeploymentRunId}
                  onFocus={props.onFocus}
                  onOpenLog={props.onOpenLog}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {focusedDeployment ? (
        <ReleaseSiteProbeEvidence
          projectId={props.projectId}
          siteProbe={focusedDeployment.siteProbe}
          routeSwitch={focusedDeployment.routeSwitch}
        />
      ) : null}
    </div>
  );
}

function ReleaseRunCard(props: {
  run: ReleaseEvidenceProductionRun;
  focused: boolean;
  recoveryHref: string;
  onFocus: (releaseRunId: string, deploymentRunId?: string) => void;
}) {
  const t = useTranslations('projects');
  const { run, focused } = props;
  const running = ['running', 'queued', 'created', 'pending'].includes(run.status.toLowerCase());
  const needsRecovery = run.status === 'failed' || run.operationApproval.status === 'rejected';
  return (
    <article
      className={`rounded-md border p-4 text-sm ${focused ? 'ring-2 ring-primary' : ''}`}
      aria-current={focused ? 'true' : undefined}
      data-release-run-id={run.id}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-medium">
          {t('releaseProductionReleaseRun')} {run.id}
        </h4>
        <StatusTag
          status={releaseRunStateTone(run.status)}
          label={t(releaseRunStatusLabelKey(run.status))}
        />
        <StatusTag
          status={releaseApprovalStateTone(run.operationApproval.status)}
          label={`${t('releaseProductionApproval')} · ${t(releaseApprovalStatusLabelKey(run.operationApproval.status))}`}
        />
        {running ? (
          <span
            className="inline-flex items-center gap-1 text-xs text-cyan-700"
            data-running-indicator="true"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-600" />
            {t('releaseProductionRunningBanner')}
          </span>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <CardCell
          label={t('releaseRunCardRun')}
          value={<code>{run.id}</code>}
        />
        <CardCell
          label={t('releaseRunCardEnvironment')}
          value={t(releaseEnvironmentLabelKey(run.environment.baselineRole))}
        />
        <CardCell
          label={t('releaseRunCardFrozenArtifact')}
          value={<code className="break-all">{run.manifest.digest}</code>}
        />
        <CardCell
          label={t('releaseRunCardStatus')}
          value={t(releaseRunStatusLabelKey(run.status))}
        />
        <CardCell
          label={t('releaseRunCardCreatedAt')}
          value={formatIso(run.createdAt)}
        />
      </div>
      {run.stagingProof ? (
        <p className="mt-2 break-all font-mono text-xs">
          {t(releaseEnvironmentLabelKey('staging'))} DeploymentRun{' '}
          {run.stagingProof.deploymentRunId}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => props.onFocus(run.id)}
        >
          {t('focusReleaseRunEvidence')}
        </Button>
        {needsRecovery ? (
          <LinkButton
            href={props.recoveryHref}
            variant="outline"
            size="sm"
          >
            {t('releaseProductionRecoveryLink')}
          </LinkButton>
        ) : null}
      </div>
    </article>
  );
}

function DeploymentRow(props: {
  run: ReleaseEvidenceProductionRun['deploymentRuns'][number];
  releaseRun: ReleaseEvidenceProductionRun;
  focused: boolean;
  onFocus: (releaseRunId: string, deploymentRunId?: string) => void;
  onOpenLog: (deploymentRunId: string) => void;
}) {
  const t = useTranslations('projects');
  const { run, releaseRun, focused } = props;
  const technical = productionTechnicalConclusion(run);
  const business = productionBusinessConclusion(run);
  return (
    <tr
      className={focused ? 'bg-primary/5' : undefined}
      aria-current={focused ? 'true' : undefined}
      data-deployment-run-id={run.id}
    >
      <RowHeader>
        <code className="block break-all font-semibold">DeploymentRun {run.id}</code>
        <span className="mt-1 block text-xs text-muted-foreground">
          {run.adapterKey || run.executorKey}
        </span>
      </RowHeader>
      <Cell>
        <strong className="block">
          BuildRun {run.manifest.buildRun.id} · R{run.manifest.buildRun.revision}
        </strong>
        <code className="mt-1 block break-all text-xs">
          Manifest {run.artifactManifestId || '—'}
        </code>
        <code className="block truncate text-xs text-muted-foreground">{run.manifest.digest}</code>
      </Cell>
      <Cell>
        <StatusTag
          status={releaseRunStateTone(run.status)}
          label={t(releaseRunStatusLabelKey(run.status))}
        />
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
        <span className="block">{formatDuration(run.startedAt, run.finishedAt) || '—'}</span>
        <time
          className="block text-xs text-muted-foreground"
          dateTime={run.createdAt}
        >
          {formatIso(run.createdAt)}
        </time>
      </Cell>
      <Cell>
        <div className="flex flex-col items-start gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-label={t('viewProductionLogsForRun', { id: run.id })}
            onClick={() => props.onOpenLog(run.id)}
          >
            {t('viewProductionLogs')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={t('focusDeploymentRunEvidenceForRun', { id: run.id })}
            onClick={() => props.onFocus(releaseRun.id, run.id)}
          >
            {t('focusDeploymentRunEvidence')}
          </Button>
          <ReleaseDeploymentEvidenceLink
            projectId={props.releaseRun.projectId}
            runId={run.id}
          />
        </div>
      </Cell>
    </tr>
  );
}

function CardCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-0.5 break-all text-sm font-medium">{value}</div>
    </div>
  );
}

function Conclusion(props: {
  label: string;
  conclusion: ReturnType<typeof productionTechnicalConclusion>;
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
  return (
    <th
      scope="row"
      className="px-4 py-3 text-left align-top font-normal"
    >
      {children}
    </th>
  );
}
