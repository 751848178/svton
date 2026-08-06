'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button, StatusTag } from '@/components/ui';
import type { ReleaseEvidenceProductionRun } from '../types/release-order-evidence.types';
import {
  releaseApprovalStatusLabelKey,
  releaseEnvironmentLabelKey,
  releaseRunStatusLabelKey,
} from '../utils/release-copy.model';
import { formatDuration, formatIso } from '../utils/release-time.utils';
import { releaseOrderStatusTone } from '../utils/release-order.utils';
import { ReleaseDeploymentEvidenceLink } from './release-deployment-evidence-link';
import { ReleaseSiteProbeEvidence } from './release-site-probe-evidence';

interface Props {
  projectId: string;
  items: ReleaseEvidenceProductionRun[];
  total: number;
  focusedReleaseRunId?: string;
  focusedDeploymentRunId?: string;
  onFocus: (releaseRunId: string, deploymentRunId?: string) => void;
}

export function ReleaseProductionEvidenceList(props: Props) {
  const t = useTranslations('projects');
  return (
    <div className="space-y-3">
      {props.total > props.items.length ? (
        <p className="text-xs text-muted-foreground">
          {t('releaseEvidenceHistoryLimited', { shown: props.items.length, total: props.total })}
        </p>
      ) : null}
      {props.items.map((run) => {
        const focused = run.id === props.focusedReleaseRunId;
        return (
          <article
            key={run.id}
            className={`rounded-md border p-4 text-sm ${focused ? 'ring-2 ring-primary' : ''}`}
            aria-current={focused ? 'true' : undefined}
            data-release-run-id={run.id}
          >
            <div className="flex flex-wrap items-center gap-2">
              <strong>ReleaseRun {run.id}</strong>
              <StatusTag
                status={releaseOrderStatusTone(run.status)}
                label={t(releaseRunStatusLabelKey(run.status))}
              />
              <StatusTag
                status={releaseOrderStatusTone(run.operationApproval.status)}
                label={`${t('releaseProductionApproval')} · ${t(releaseApprovalStatusLabelKey(run.operationApproval.status))}`}
              />
            </div>
            <p className="mt-2 break-all font-mono text-xs">
              BuildRun {run.manifest.buildRun.id} / #{run.manifest.buildRun.revision}
            </p>
            <p className="mt-1 break-all font-mono text-xs">
              Manifest {run.manifest.id} / {run.manifest.digest}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(releaseEnvironmentLabelKey(run.environment.baselineRole))} · {run.environment.id}
            </p>
            {run.stagingProof ? (
              <p className="mt-1 break-all font-mono text-xs">
                {t(releaseEnvironmentLabelKey('staging'))} DeploymentRun{' '}
                {run.stagingProof.deploymentRunId}
              </p>
            ) : null}
            <div className="mt-3 space-y-2">
              {run.deploymentRuns.map((deployment) => {
                const deploymentFocused = deployment.id === props.focusedDeploymentRunId;
                return (
                  <div
                    key={deployment.id}
                    className={`rounded bg-muted/40 p-3 ${deploymentFocused ? 'ring-2 ring-primary' : ''}`}
                    data-deployment-run-id={deployment.id}
                  >
                    <p className="break-all font-mono text-xs">
                      DeploymentRun {deployment.id} ·{' '}
                      {t(releaseRunStatusLabelKey(deployment.status))}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDuration(deployment.startedAt, deployment.finishedAt) || '—'} ·{' '}
                      {formatIso(deployment.createdAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => props.onFocus(run.id, deployment.id)}
                      >
                        {t('focusDeploymentRunEvidence')}
                      </Button>
                      <ReleaseDeploymentEvidenceLink
                        projectId={props.projectId}
                        runId={deployment.id}
                      />
                    </div>
                    <ReleaseSiteProbeEvidence
                      projectId={props.projectId}
                      siteProbe={deployment.siteProbe}
                      routeSwitch={deployment.routeSwitch}
                    />
                  </div>
                );
              })}
            </div>
            <Button
              className="mt-3"
              variant="ghost"
              size="sm"
              onClick={() => props.onFocus(run.id)}
            >
              {t('focusReleaseRunEvidence')}
            </Button>
          </article>
        );
      })}
    </div>
  );
}
