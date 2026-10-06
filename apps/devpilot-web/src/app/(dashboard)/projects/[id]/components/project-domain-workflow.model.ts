import type { Site } from '@/app/(dashboard)/sites/types';
import type { ConfigRevisionDraft } from '../hooks/use-environment-config-governance';
import type { EnvironmentConfigRevision } from '../types/environment-config-revision.types';
import type { ProjectApplication } from '../types';
import type { ProjectEnvironment } from '../types';
import { selectExistingProjectEnvironments } from '../utils/project-environment-list';
import { servicePorts } from './settings/settings-route-target-options.model';

export type DomainTlsMode = 'none' | 'managed_cert' | 'existing_cert_asset';

export type ProjectDomainTarget = {
  key: string;
  applicationId: string;
  serviceId: string;
  component: string;
  port: number;
  serverId: string | null;
  serverLabel: string | null;
  siteId: string | null;
};

export type ProjectDomainWorkflowForm = {
  targetKey: string;
  path: string;
  name: string;
  primaryDomain: string;
  aliases: string;
  tlsMode: DomainTlsMode;
  changeReason: string;
};

export function selectProjectDomainEnvironments(
  environments: ProjectEnvironment[] | undefined,
  sites: Site[],
) {
  const existing = selectExistingProjectEnvironments(environments);
  const included = new Set(existing.map((environment) => environment.id));
  const siteEnvironmentIds = new Set(
    sites.map((site) => site.environment?.id).filter((id): id is string => Boolean(id)),
  );
  return (environments ?? []).filter((environment) =>
    environment.status !== 'archived'
      && (included.has(environment.id) || siteEnvironmentIds.has(environment.id)),
  );
}

export function buildProjectDomainTargets(
  applications: ProjectApplication[],
  environmentId: string,
): ProjectDomainTarget[] {
  return applications.flatMap((application) =>
    (application.services ?? [])
      .filter((service) => service.status === 'active' && service.environment?.id === environmentId)
      .flatMap((service) => servicePorts(service).map((port) => ({
        key: `${application.id}:${service.id}:${port}`,
        applicationId: application.id,
        serviceId: service.id,
        component: service.name,
        port,
        serverId: service.server?.id ?? null,
        serverLabel: service.server ? `${service.server.name} · ${service.server.host}` : null,
        siteId: service.site?.id ?? null,
      }))),
  );
}

export function initialDomainWorkflowForm(params: {
  site?: Site | null;
  targets: ProjectDomainTarget[];
  revision?: EnvironmentConfigRevision | null;
}): ProjectDomainWorkflowForm {
  const route = params.site ? routeEntryForSite(params.revision, params.site) : null;
  const bound = params.site
    ? params.targets.find((target) => target.siteId === params.site?.id)
    : params.targets.find((target) => !target.siteId);
  const selected = bound
    ? params.targets.find((target) => target.serviceId === bound.serviceId && target.port === route?.port)
      ?? bound
    : null;
  return {
    targetKey: selected?.key ?? '',
    path: route?.path || '/',
    name: params.site?.name ?? '',
    primaryDomain: params.site?.primaryDomain ?? '',
    aliases: params.site?.aliases?.join(', ') ?? '',
    tlsMode: route?.tlsMode ?? observedTlsMode(params.site),
    changeReason: '',
  };
}

export function routeEntryForSite(revision: EnvironmentConfigRevision | null | undefined, site: Site) {
  const domains = new Set([site.primaryDomain, ...(site.aliases ?? [])].map(normalizeDomain));
  return (revision?.routeSnapshot.entries ?? []).find((entry) => domains.has(normalizeDomain(entry.domain))) ?? null;
}

export function buildDomainRevisionDraft(params: {
  current: EnvironmentConfigRevision | null;
  form: ProjectDomainWorkflowForm;
  target: ProjectDomainTarget;
  originalDomain?: string | null;
}): ConfigRevisionDraft {
  const current = params.current;
  const original = normalizeDomain(params.originalDomain ?? '');
  const nextEntry = {
    domain: normalizeDomain(params.form.primaryDomain),
    path: normalizePath(params.form.path),
    serviceId: params.target.serviceId,
    component: params.target.component,
    port: params.target.port,
    tlsMode: params.form.tlsMode,
  };
  const entries = (current?.routeSnapshot.entries ?? [])
    .filter((entry) => !original || normalizeDomain(entry.domain) !== original)
    .filter((entry) => normalizeDomain(entry.domain) !== nextEntry.domain)
    .concat(nextEntry);
  return {
    secretReferences: (current?.secretReferences ?? []).map((item) => ({
      id: item.id,
      targetEnvKey: item.targetEnvKey ?? '',
    })),
    resourceReferences: current?.resourceReferences ?? [],
    routeSnapshot: {
      ...(current?.routeSnapshot ?? {}),
      domains: [...new Set(entries.map((entry) => entry.domain))].sort(),
      tlsRequired: entries.some((entry) => entry.tlsMode !== 'none'),
      entries,
    },
    observabilitySnapshot: current?.observabilitySnapshot,
    policyReferenceIds: (current?.policyReferences ?? []).map((item) => item.id),
    changeSummary: params.form.changeReason.trim(),
  };
}

export function domainExists(
  sites: Site[],
  domain: string,
  editingSiteId?: string | null,
) {
  const candidate = normalizeDomain(domain);
  return sites.some((site) =>
    site.id !== editingSiteId
      && [site.primaryDomain, ...(site.aliases ?? [])].some((value) => normalizeDomain(value) === candidate),
  );
}

export function normalizePath(value: string) {
  const path = value.trim();
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function normalizeDomain(value: string) {
  return value.trim().toLowerCase();
}

function observedTlsMode(site?: Site | null): DomainTlsMode {
  if (!site?.tls?.enabled) return 'none';
  return site.tls.type === 'custom' ? 'existing_cert_asset' : 'managed_cert';
}
