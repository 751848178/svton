'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { DeploymentRun } from '../types/operations';
import { ReleaseSiteProbeEvidence } from './release-site-probe-evidence';
import { parseRunProbeEvidence } from './settings/settings-env-routes.model';
import { deploymentHealthEvidence } from './project-deployment-evidence.model';
import { DeploymentEvidenceEmpty, ProjectDeploymentEvidenceSection } from './project-deployment-evidence-section';

export function ProjectDeploymentValidation(props: { run: DeploymentRun; projectId: string }) {
  const t = useTranslations('projects');
  const health = deploymentHealthEvidence(props.run);
  const probe = parseRunProbeEvidence(props.run);
  const hasHealth = Boolean(health.target || health.step || health.observed);
  return (
    <ProjectDeploymentEvidenceSection
      title={t('deploymentEvidenceValidation')}
      description={t('deploymentEvidenceValidationDescription')}
    >
      {hasHealth ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact label={t('deploymentEvidenceHealthTarget')} value={health.target} mono />
          <Fact label={t('deploymentEvidenceHealthStep')} value={health.step?.label} />
          <Fact label={t('deploymentEvidenceHealthStatus')} value={health.observed?.status} />
          <Fact label={t('deploymentEvidenceExitCode')} value={number(health.observed?.exitCode)} />
          <Fact label={t('deploymentColumnDuration')} value={duration(health.observed?.durationMs)} />
        </dl>
      ) : null}
      {probe ? (
        <ReleaseSiteProbeEvidence
          projectId={props.projectId}
          siteProbe={probe.siteProbe}
          routeSwitch={probe.routeSwitch}
        />
      ) : null}
      {!hasHealth && !probe ? (
        <DeploymentEvidenceEmpty>{t('deploymentEvidenceNoValidation')}</DeploymentEvidenceEmpty>
      ) : null}
    </ProjectDeploymentEvidenceSection>
  );
}

function Fact(props: { label: string; value?: string | null; mono?: boolean }) {
  const t = useTranslations('projects');
  return (
    <div className="rounded-md border p-3">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className={props.mono ? 'mt-1 break-all font-mono text-xs' : 'mt-1 break-words text-sm'}>
        {props.value || t('domainEvidenceUnavailable')}
      </dd>
    </div>
  );
}

function number(value?: number) {
  return typeof value === 'number' ? String(value) : undefined;
}

function duration(value?: number) {
  return typeof value === 'number' ? `${value} ms` : undefined;
}
