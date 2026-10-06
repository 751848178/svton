import type { Site } from '@/app/(dashboard)/sites/types';
import type { EnvironmentConfigRevision } from '../types/environment-config-revision.types';
import type { ProjectApplication } from '../types';
import { buildProjectDomainTargets, routeEntryForSite } from './project-domain-workflow.model';

export interface DomainEntryFact {
  primary: string;
  secondary?: string;
}

export function domainAliases(site: Site): string[] {
  return Array.isArray(site.aliases)
    ? site.aliases.filter((alias): alias is string => typeof alias === 'string' && alias.length > 0)
    : [];
}

export function domainTarget(
  site: Site,
  revision?: EnvironmentConfigRevision | null,
  applications: ProjectApplication[] = [],
): DomainEntryFact {
  const route = routeEntryForSite(revision, site);
  if (route) {
    const target = buildProjectDomainTargets(applications, site.environment?.id ?? '')
      .find((item) => item.serviceId === route.serviceId && item.port === route.port);
    return {
      primary: `${route.component}:${route.port ?? '—'}`,
      secondary: `${route.path || '/'}${target?.serverLabel ? ` · ${target.serverLabel}` : ''}`,
    };
  }
  const config = site.runtimeConfig ?? {};
  const rootPath = stringValue(config.rootPath);
  const upstreamUrl = stringValue(config.upstreamUrl);
  const containerName = stringValue(config.containerName);
  const containerPort = stringValue(config.containerPort);

  if (site.runtimeType === 'static' && rootPath) {
    return { primary: rootPath, secondary: site.server ? serverLabel(site) : undefined };
  }
  if (site.runtimeType === 'docker' && (containerName || containerPort)) {
    const container = [containerName, containerPort].filter(Boolean).join(':');
    return { primary: container, secondary: upstreamUrl || serverLabel(site) };
  }
  if (upstreamUrl) {
    return { primary: upstreamUrl, secondary: site.server ? serverLabel(site) : undefined };
  }
  if (site.proxyConfig) {
    return {
      primary: site.proxyConfig.domain,
      secondary: site.proxyConfig.name,
    };
  }
  return site.server ? { primary: serverLabel(site) } : { primary: '—' };
}

export function domainEvidence(site: Site) {
  return {
    dnsStatus: site.dns?.status ?? null,
    dnsCheckedAt: site.dns?.checkedAt ?? null,
    probeStatus: site.tls?.probe?.status ?? null,
    probeCheckedAt: site.tls?.probe?.checkedAt ?? null,
  };
}

export function tlsLabel(site: Site, revision?: EnvironmentConfigRevision | null): string {
  const route = routeEntryForSite(revision, site);
  if (route?.tlsMode === 'none') return 'HTTP';
  if (route?.tlsMode === 'managed_cert') return 'Managed TLS';
  if (route?.tlsMode === 'existing_cert_asset') return 'TLS Asset';
  if (!site.tls) return '—';
  if (site.tls.enabled === false) return 'HTTP';
  return String(site.tls.status || site.tls.type || 'TLS');
}

function serverLabel(site: Site): string {
  return site.server ? `${site.server.name} · ${site.server.host}` : '';
}

function stringValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
