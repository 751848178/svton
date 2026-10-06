'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { DeploymentRun } from '../types/operations';
import { getRunSourceLabelKey, getRunStatusLabelKey, shortSha } from '../utils/run-labels';
import { deploymentReleaseOrderId } from './project-deployment-evidence.model';
import { ProjectDeploymentEvidenceSection } from './project-deployment-evidence-section';

export function ProjectDeploymentOverview(props: { run: DeploymentRun; projectId: string }) {
  const t = useTranslations('projects');
  const run = props.run;
  const orderId = deploymentReleaseOrderId(run);
  const sourceKey = getRunSourceLabelKey(run.source);
  const facts = [
    [t('deploymentEvidenceRunId'), run.id, true],
    [t('runDetailEnvironment'), run.projectEnvironment?.name ?? run.environment ?? '—'],
    [t('runDetailApplication'), run.application?.name ?? '—'],
    [t('runDetailService'), run.applicationService?.name ?? '—'],
    [t('runDetailServer'), run.server ? `${run.server.name} · ${run.server.host}` : '—'],
    [t('runDetailTarget'), run.targetType || '—'],
    [t('deploymentEvidenceSource'), sourceKey ? t(sourceKey) : run.source],
    [t('deploymentEvidenceCommit'), shortSha(run.commitSha) ?? '—', true],
    [t('runDetailStarted'), formatDateTimeMinute(run.startedAt)],
    [t('runDetailFinished'), run.finishedAt ? formatDateTimeMinute(run.finishedAt) : '—'],
    [t('deploymentColumnActor'), run.actor?.name || run.actor?.email || '—'],
    [t('runDetailMode'), run.dryRun ? t('runModePlanOnly') : t('runModeLiveRequest')],
  ] as const;
  return (
    <div className="space-y-4">
      {run.error ? (
        <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-semibold text-destructive">{t('deploymentFailureTitle')}</p>
          <p className="mt-1 break-words text-sm">{run.error}</p>
          <p className="mt-2 text-xs text-muted-foreground">{t('deploymentFailureImpact')}</p>
          {orderId ? <ReleaseLink projectId={props.projectId} orderId={orderId} /> : null}
        </section>
      ) : null}
      <ProjectDeploymentEvidenceSection title={t('deploymentEvidenceOverview')}>
        <div className="mb-4 flex items-center gap-2">
          <StatusTag status={run.status} label={t(getRunStatusLabelKey(run.status))} />
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          {facts.map(([label, value, mono]) => (
            <div key={label} className="min-w-0 rounded-md border p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className={mono ? 'mt-1 break-all font-mono text-xs' : 'mt-1 break-words text-sm'}>{value}</dd>
            </div>
          ))}
        </dl>
      </ProjectDeploymentEvidenceSection>
    </div>
  );
}

function ReleaseLink({ projectId, orderId }: { projectId: string; orderId: string }) {
  const t = useTranslations('projects');
  return (
    <Link className="mt-3 inline-flex min-h-11 items-center font-medium text-primary hover:underline"
      href={`/projects/${encodeURIComponent(projectId)}/releases/${encodeURIComponent(orderId)}`}>
      {t('deploymentOpenRelease')}
    </Link>
  );
}
