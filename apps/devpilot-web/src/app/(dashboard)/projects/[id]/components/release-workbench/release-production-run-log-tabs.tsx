'use client';

import { useTranslations } from 'next-intl';
import { Tabs } from '@svton/ui';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import {
  releaseApprovalStatusLabelKey,
  releaseExecutionStatusLabelKey,
} from '../../utils/release-copy.model';
import { shortDigest, shortTechnicalId } from '../../utils/release-display.utils';
import { formatIso } from '../../utils/release-time.utils';
import { FlowStatusTag } from './release-flow-status-tag';
import { ReleaseProductionFact } from './release-production-fact';
import { ReleaseProductionRunStages } from './release-production-run-stages';

const MAX_LOG_LENGTH = 12_000;

export function ReleaseProductionRunLogTabs(props: { run: ReleaseEvidenceProductionRun }) {
  const t = useTranslations('projects');
  const run = props.run;
  return (
    <Tabs
      type="line"
      defaultActiveKey="overview"
      items={[
        {
          key: 'overview',
          label: t('deploymentEvidenceOverview'),
          children: <Overview run={run} />,
        },
        {
          key: 'execution',
          label: t('releaseProductionExecutionTab'),
          children: <ReleaseProductionRunStages runs={run.deploymentRuns} />,
        },
        {
          key: 'logs',
          label: t('deploymentEvidenceLogs'),
          children: <Logs run={run} />,
        },
        {
          key: 'technical',
          label: t('releaseRunTechnicalDetails'),
          children: <Technical run={run} />,
        },
      ]}
    />
  );
}

function Overview(props: { run: ReleaseEvidenceProductionRun }) {
  const t = useTranslations('projects');
  const run = props.run;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <FlowStatusTag
          status={run.status.toLowerCase()}
          label={t(releaseExecutionStatusLabelKey(run.status))}
        />
        <span className="text-xs text-muted-foreground">
          {t('releaseApprovalStatus')} ·{' '}
          {t(releaseApprovalStatusLabelKey(run.operationApproval.status))}
        </span>
      </div>
      <dl className="grid gap-3 border-y py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <ReleaseProductionFact
          label={t('releaseBuildEnvironment')}
          value={run.environment.name}
        />
        <ReleaseProductionFact
          label={t('releaseBuildRevisionLabel')}
          value={t('releaseBuildRevision', { revision: run.manifest.buildRun.revision })}
        />
        <ReleaseProductionFact
          label={t('releaseRunCardCreatedAt')}
          value={formatIso(run.createdAt)}
        />
        <ReleaseProductionFact
          label={t('releaseLifecycleOutcome.finishedAt')}
          value={formatIso(run.finishedAt)}
        />
      </dl>
      {run.errorCode || run.errorMessage ? (
        <div
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
          role="alert"
        >
          <p className="font-semibold text-destructive">{t('releaseProductionFailureTitle')}</p>
          <p className="mt-1">{run.errorMessage || t('releaseBuildUnavailable')}</p>
        </div>
      ) : null}
    </div>
  );
}

function Logs(props: { run: ReleaseEvidenceProductionRun }) {
  const t = useTranslations('projects');
  return (
    <div className="space-y-5">
      {props.run.deploymentRuns.length > 0 ? (
        props.run.deploymentRuns.map((deployment) => (
          <section key={deployment.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-medium">
                DeploymentRun {shortTechnicalId(deployment.id)}
              </h4>
              <FlowStatusTag
                status={deployment.status.toLowerCase()}
                label={t(releaseExecutionStatusLabelKey(deployment.status))}
              />
            </div>
            <pre
              className="mt-3 whitespace-pre-wrap break-all rounded-md bg-muted p-4 font-mono text-xs"
              role="log"
            >
              {logs(deployment.logs) || t('releaseStagingLogsEmpty')}
            </pre>
          </section>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">
          {t('releaseProductionDeploymentStagesEmpty')}
        </p>
      )}
    </div>
  );
}

function Technical(props: { run: ReleaseEvidenceProductionRun }) {
  const t = useTranslations('projects');
  const run = props.run;
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <ReleaseProductionFact
        label={t('releaseStagingRunId')}
        value={shortTechnicalId(run.id)}
        title={run.id}
        mono
      />
      <ReleaseProductionFact
        label={t('productionArtifact')}
        value={shortDigest(run.manifest.digest)}
        title={run.manifest.digest}
        mono
      />
      <ReleaseProductionFact
        label={t('releaseBuildRevisionLabel')}
        value={shortDigest(run.manifest.buildRun.sourceCommitSha)}
        title={run.manifest.buildRun.sourceCommitSha}
        mono
      />
      <ReleaseProductionFact
        label={t('releaseProductionStagingProofLabel')}
        value={run.stagingProof ? shortTechnicalId(run.stagingProof.deploymentRunId) : '—'}
        title={run.stagingProof?.deploymentRunId}
        mono
      />
      <ReleaseProductionFact
        label={t('releaseProductionAcceptanceMode')}
        value={run.acceptanceMode || '—'}
      />
      {run.errorCode ? (
        <ReleaseProductionFact
          label={t('releaseStagingErrorEvidence')}
          value={run.errorCode}
          mono
        />
      ) : null}
    </dl>
  );
}

function logs(value: unknown) {
  const raw = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').join('\n')
    : typeof value === 'string'
      ? value
      : '';
  return raw.length > MAX_LOG_LENGTH ? `${raw.slice(0, MAX_LOG_LENGTH)}\n…` : raw;
}
