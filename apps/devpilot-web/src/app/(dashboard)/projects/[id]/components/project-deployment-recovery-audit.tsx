'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { AuditEvent } from '@/app/(dashboard)/audit-events/types';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { DeploymentRun } from '../types/operations';
import { DeploymentEvidenceEmpty, ProjectDeploymentEvidenceSection } from './project-deployment-evidence-section';

export function ProjectDeploymentRecoveryAudit(props: {
  run: DeploymentRun;
  audits: AuditEvent[];
  error: string;
}) {
  const t = useTranslations('projects');
  const approval = props.run.operationApproval ?? props.run.releaseRun?.operationApproval;
  return (
    <ProjectDeploymentEvidenceSection
      title={t('deploymentEvidenceRecoveryAudit')}
      description={t('deploymentEvidenceRecoveryAuditDescription')}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Fact label={t('deploymentEvidenceRunMode')} value={props.run.mode} />
        <Fact label={t('deploymentEvidenceSourceRun')} value={props.run.sourceRun?.id} mono />
        <Fact label={t('runDetailApproval')} value={approval ? `${approval.status} · ${approval.risk}` : undefined} />
        <Fact label={t('runDetailExecution')} value={props.run.serverExecutionJob?.status} />
      </div>
      <p className="mt-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        {t('deploymentEvidenceCapabilitiesUnavailable')}
      </p>
      <div className="mt-5">
        <h4 className="text-xs font-semibold">{t('deploymentEvidenceAuditEvents')}</h4>
        {props.error ? <p role="alert" className="mt-2 text-sm text-destructive">{props.error}</p> : null}
        {!props.error && props.audits.length === 0 ? (
          <div className="mt-2"><DeploymentEvidenceEmpty>{t('deploymentEvidenceNoAudit')}</DeploymentEvidenceEmpty></div>
        ) : (
          <ol className="mt-2 divide-y rounded-md border">
            {props.audits.map((event) => (
              <li key={event.id} className="grid gap-1 p-3 text-xs sm:grid-cols-[140px_1fr]">
                <time className="text-muted-foreground">{formatDateTimeMinute(event.occurredAt)}</time>
                <div>
                  <p className="font-medium">{event.action} · {event.status}</p>
                  <p className="mt-1 break-words text-muted-foreground">{event.summary || event.targetType}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </ProjectDeploymentEvidenceSection>
  );
}

function Fact(props: { label: string; value?: string | null; mono?: boolean }) {
  const t = useTranslations('projects');
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p className={props.mono ? 'mt-1 break-all font-mono text-xs' : 'mt-1 break-words text-sm'}>
        {props.value || t('domainEvidenceUnavailable')}
      </p>
    </div>
  );
}
