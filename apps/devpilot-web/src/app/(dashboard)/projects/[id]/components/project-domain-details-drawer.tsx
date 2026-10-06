'use client';

import React from 'react';
import Link from 'next/link';
import { Drawer } from '@svton/ui';
import { useTranslations } from 'next-intl';
import type { Site, SiteSyncPlan } from '@/app/(dashboard)/sites/types';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { EnvironmentConfigRevision } from '../types/environment-config-revision.types';
import type { DeploymentRun } from '../types/operations';
import type { ProjectApplication, ProjectEnvironment } from '../types';
import { latestSiteProbeEvidence } from './settings/settings-site-probe-evidence.model';
import {
  buildProjectDomainTargets,
  routeEntryForSite,
} from './project-domain-workflow.model';

export function ProjectDomainDetailsDrawer(props: {
  site: Site | null;
  projectId: string;
  environment: ProjectEnvironment;
  applications: ProjectApplication[];
  revision: EnvironmentConfigRevision | null;
  runs: DeploymentRun[];
  plan?: SiteSyncPlan;
  loadingPlan: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('projects');
  const site = props.site;
  if (!site) return null;
  const route = routeEntryForSite(props.revision, site);
  const target = buildProjectDomainTargets(props.applications, props.environment.id)
    .find((item) => item.siteId === site.id && (!route?.serviceId || item.serviceId === route.serviceId));
  const probe = latestSiteProbeEvidence(props.runs, props.environment, site);
  return (
    <Drawer
      open
      onClose={props.onClose}
      title={t('domainDetailsTitle', { domain: site.primaryDomain })}
      description={`${props.environment.name} (${props.environment.key})`}
      width={680}
      ariaCloseLabel={t('domainDetailsClose')}
    >
      <div className="space-y-5 pb-6">
        <EvidenceSection title={t('domainDetailsConfigTitle')}>
          <DetailRow label={t('domainWorkflowComponentFact')} value={route?.component ?? target?.component} />
          <DetailRow label={t('domainWorkflowPathLabel')} value={route?.path} mono />
          <DetailRow label={t('domainWorkflowPortFact')} value={route?.port ? String(route.port) : undefined} />
          <DetailRow label={t('domainWorkflowTlsIntentLabel')} value={route?.tlsMode ? t(`domainWorkflowTlsMode_${route.tlsMode}`) : undefined} />
          <DetailRow
            label={t('domainWorkflowServerFact')}
            value={target?.serverLabel ?? (site.server ? `${site.server.name} · ${site.server.host}` : undefined)}
          />
          <PlanEvidence plan={props.plan} loading={props.loadingPlan} />
        </EvidenceSection>
        <EvidenceSection title={t('domainDetailsDnsTitle')}>
          <DetailRow label={t('releaseOrderColumnStatus')} value={site.dns?.status ?? undefined} />
          <DetailRow label={t('domainDetailsHostname')} value={site.dns?.hostname ?? undefined} mono />
          <DetailRow label={t('domainDetailsRecords')} value={site.dns?.records?.join(', ')} mono />
          <DetailRow label={t('domainDetailsCheckedAt')} value={date(site.dns?.checkedAt)} />
        </EvidenceSection>
        <EvidenceSection title={t('domainDetailsTlsTitle')}>
          <DetailRow label={t('releaseOrderColumnStatus')} value={site.tls?.status ?? undefined} />
          <DetailRow label={t('domainDetailsTlsType')} value={site.tls?.type ?? undefined} />
          <DetailRow label={t('domainDetailsExpiresAt')} value={date(site.tls?.expiresAt)} />
          <DetailRow label={t('domainDetailsCheckedAt')} value={date(site.tls?.probe?.checkedAt)} />
        </EvidenceSection>
        <EvidenceSection title={t('domainDetailsProbeTitle')}>
          <DetailRow label={t('domainDetailsHttpStatus')} value={probe?.evidence.siteProbe?.http.status ?? undefined} />
          <DetailRow label={t('domainDetailsHttpCode')} value={number(probe?.evidence.siteProbe?.http.statusCode)} />
          <DetailRow label="URL" value={probe?.evidence.siteProbe?.http.finalUrl ?? probe?.evidence.siteProbe?.http.url ?? undefined} mono />
          <DetailRow label={t('domainDetailsCheckedAt')} value={date(probe?.evidence.siteProbe?.http.checkedAt)} />
          <DetailRow label={t('domainDetailsRouteSwitch')} value={site.routeSwitch?.status ?? undefined} />
          <DetailRow label={t('domainDetailsRouteTarget')} value={site.routeSwitch?.targetRef ?? site.routeSwitch?.proxyTarget ?? undefined} mono />
          {probe ? (
            <Link
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
              href={`/projects/${encodeURIComponent(props.projectId)}/deployments?runId=${encodeURIComponent(probe.run.id)}`}
            >
              {t('domainDetailsOpenRun')}
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground">{t('domainEvidenceUnavailable')}</p>
          )}
        </EvidenceSection>
      </div>
    </Drawer>
  );
}

function PlanEvidence({ plan, loading }: { plan?: SiteSyncPlan; loading: boolean }) {
  const t = useTranslations('projects');
  if (loading) return <p className="mt-3 text-xs text-muted-foreground">{t('domainConfigPreviewLoading')}</p>;
  if (!plan) return <p className="mt-3 text-xs text-muted-foreground">{t('domainConfigPreviewEmpty')}</p>;
  return (
    <div className="mt-3 space-y-2 border-t pt-3 text-xs">
      <DetailRow label={t('releaseOrderColumnStatus')} value={plan.status} />
      <DetailRow label={t('domainConfigPreviewTargetPath')} value={plan.target?.configPath} mono />
      <DetailRow label={t('domainConfigPreviewDiffSummary')} value={plan.configDiff?.summary} />
      {plan.warnings.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-amber-800">
          {plan.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
      {plan.error ? <p className="text-destructive">{plan.error}</p> : null}
    </div>
  );
}

function EvidenceSection(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold">{props.title}</h3>
      <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2">{props.children}</div>
    </section>
  );
}

function DetailRow(props: { label: string; value?: string | null; mono?: boolean }) {
  const t = useTranslations('projects');
  return (
    <div>
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p className={props.mono ? 'mt-1 break-all font-mono text-xs' : 'mt-1 break-words text-sm'}>
        {props.value || t('domainEvidenceUnavailable')}
      </p>
    </div>
  );
}

function date(value?: string | null) {
  return value ? formatDateTimeMinute(value) : undefined;
}

function number(value?: number | null) {
  return typeof value === 'number' ? String(value) : undefined;
}
