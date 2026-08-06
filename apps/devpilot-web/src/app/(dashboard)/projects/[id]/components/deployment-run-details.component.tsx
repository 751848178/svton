'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { DeploymentRun } from '../types/operations';
import {
  releaseApprovalStatusLabelKey,
  releaseEnvironmentValueLabelKey,
  releaseRiskLabelKey,
  releaseRunStatusLabelKey,
} from '../utils/release-copy.model';
import { DeployVarPreview } from './deploy-var-preview';
import { DeploymentStageTimeline } from './deployment-stage-timeline.component';

const MAX_RAW_LENGTH = 12_000;

export function DeploymentRunDetails({ run }: { run: DeploymentRun }) {
  const t = useTranslations('projects');
  const environmentKey = releaseEnvironmentValueLabelKey(
    run.projectEnvironment?.key || run.environment,
  );
  const facts = [
    [t('runDetailMode'), run.dryRun ? t('runModePlanOnly') : t('runModeLiveRequest')],
    [t('runDetailTarget'), run.targetType || '-'],
    [
      t('runDetailEnvironment'),
      environmentKey ? t(environmentKey) : run.projectEnvironment?.name || run.environment || '-',
    ],
    [t('runDetailApplication'), run.application?.name || '-'],
    [t('runDetailService'), run.applicationService?.name || '-'],
    [t('runDetailServer'), run.server ? `${run.server.name} (${run.server.host})` : '-'],
    [t('runDetailStarted'), formatDateTimeMinute(run.startedAt)],
    [t('runDetailFinished'), run.finishedAt ? formatDateTimeMinute(run.finishedAt) : '-'],
  ];
  return (
    <div className="mt-3 space-y-4 border-t pt-3">
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(([label, value]) => (
          <div
            key={label}
            className="rounded-md bg-muted/40 p-2"
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-all text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <StateEvidence run={run} />
      <section>
        <h4 className="text-sm font-medium">{t('runDetailPlan')}</h4>
        <DeploymentStageTimeline run={run} />
      </section>
      <DeployVarPreview
        run={run}
        t={t}
      />
      {run.error ? (
        <RawEvidence
          title={t('runDetailError')}
          value={run.error}
          tone="danger"
        />
      ) : null}
      {run.logs ? (
        <RawEvidence
          title={t('runDetailLogs')}
          value={run.logs}
        />
      ) : null}
      {run.result ? (
        <RawEvidence
          title={t('runDetailResult')}
          value={run.result}
        />
      ) : null}
    </div>
  );
}

function StateEvidence({ run }: { run: DeploymentRun }) {
  const t = useTranslations('projects');
  const approval = run.operationApproval || run.releaseRun?.operationApproval;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <section className="rounded-md border p-3">
        <h4 className="text-sm font-medium">{t('runDetailApproval')}</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          {approval
            ? t('runDetailApprovalState', {
                status: t(releaseApprovalStatusLabelKey(approval.status)),
                risk: t(releaseRiskLabelKey(approval.risk)),
              })
            : t('runDetailNoApproval')}
        </p>
      </section>
      <section className="rounded-md border p-3">
        <h4 className="text-sm font-medium">{t('runDetailExecution')}</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          {run.serverExecutionJob
            ? t('runDetailExecutionState', {
                status: t(releaseRunStatusLabelKey(run.serverExecutionJob.status)),
                attempt: run.serverExecutionJob.attempt,
                max: run.serverExecutionJob.maxAttempts,
              })
            : run.dryRun
              ? t('runDetailPlanNotExecuted')
              : t('runDetailExecutionNotCreated')}
        </p>
      </section>
    </div>
  );
}

function RawEvidence({ title, value, tone }: { title: string; value: unknown; tone?: 'danger' }) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const content = raw.length > MAX_RAW_LENGTH ? `${raw.slice(0, MAX_RAW_LENGTH)}\n…` : raw;
  return (
    <details
      className={`rounded-md border p-3 ${tone === 'danger' ? 'border-destructive/30' : ''}`}
    >
      <summary className="cursor-pointer text-sm font-medium">{title}</summary>
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-xs">
        {content}
      </pre>
    </details>
  );
}
