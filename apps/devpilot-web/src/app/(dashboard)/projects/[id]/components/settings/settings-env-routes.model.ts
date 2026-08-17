/**
 * 环境配置子区：域名与入口 —— 纯模型
 *
 * 单一职责：把当前修订草稿的 entries（结构化 域名→组件/端口/Path/TLS 映射，
 * 兼容旧版 domains[]/proxyTarget 平铺形式）与真实 Site 探测数据（Site.dns、
 * Site.tls、Site.routeSwitch/lastSyncAt，F438）和最新生产 DeploymentRun 的
 * siteProbe 证据联接成 Demo 六列表行视图，并按 D14/D15/D16 门禁证据
 * （AC-SET-048）推导每行就绪状态。组件层只通过这里取值。
 */
import type { ProjectSite } from '../../types';
import type {
  ReleaseEvidenceRouteSwitch,
  ReleaseEvidenceSiteProbe,
} from '../../types/release-order-evidence.types';
import type { DeploymentRun } from '../../types/operations';
import type { SettingsRouteEntryDraft } from './settings-env.model';
import { latestRouteProbeEvidence } from './settings-route-probe-evidence.model';
import type { RouteProbeEvidence } from './settings-route-probe-evidence.model';
import {
  dnsReadiness,
  routeReadiness,
  tlsReadiness,
} from './settings-route-readiness.model';
import type { RouteGateReadiness } from './settings-route-readiness.model';

export const ROUTE_TLS_MODES = ['none', 'managed_cert', 'existing_cert_asset'] as const;
export type RouteTlsMode = (typeof ROUTE_TLS_MODES)[number];

export type RouteProbeState = 'ready' | 'blocked' | 'unavailable';
export type RouteEntryView = {
  key: string;
  entry: SettingsRouteEntryDraft;
  site: ProjectSite | null;
  tlsMode: RouteTlsMode;
  dns: { state: RouteProbeState; labelKey: string; detail?: string };
  tls: { state: RouteProbeState; labelKey: string; detail?: string };
  probe: {
    state: RouteProbeState;
    labelKey: string;
    detail?: string;
    checkedAt?: string | null;
  };
  readiness: {
    d14: RouteGateReadiness;
    d15: RouteGateReadiness;
    d16: RouteGateReadiness;
  };
  evidence: {
    deploymentRunId: string;
    siteProbe: ReleaseEvidenceSiteProbe | null;
    routeSwitch: ReleaseEvidenceRouteSwitch | null;
  } | null;
};

const EMPTY_PROBE_EVIDENCE: ReleaseEvidenceSiteProbe = {
  version: null,
  primaryDomain: null,
  finalUrl: null,
  probedAt: null,
  dns: { status: null, hostname: null, records: null, error: null, checkedAt: null },
  tls: { status: null, host: null, port: null, servername: null, cert: null, error: null, checkedAt: null },
  http: { status: null, url: null, finalUrl: null, statusCode: null, bodySignature: null, error: null, checkedAt: null },
};

export function buildRouteEntryViews(params: {
  entries: SettingsRouteEntryDraft[];
  sites: ProjectSite[];
  deploymentRuns: DeploymentRun[];
}): RouteEntryView[] {
  const latestEvidence = latestRouteProbeEvidence(params.deploymentRuns);
  return params.entries.map((entry, index) => {
    const site = matchSiteByDomain(params.sites, entry.domain);
    return {
      key: `${index}-${entry.domain}-${entry.path}`,
      entry,
      site,
      tlsMode: entry.tlsMode,
      dns: dnsView(site),
      tls: tlsView(site),
      probe: probeView(site, latestEvidence),
      readiness: {
        d14: dnsReadiness(site),
        d15: entry.tlsMode === 'none'
          ? { state: 'ready', labelKey: 'envRoutesGateNotApplicable' }
          : tlsReadiness(site),
        d16: routeReadiness(site),
      },
      evidence: latestEvidence,
    };
  });
}

export function matchSiteByDomain(
  sites: ProjectSite[],
  domain: string,
): ProjectSite | null {
  const normalized = domain.trim().toLowerCase();
  return (
    sites.find((site) => site.primaryDomain.toLowerCase() === normalized) ??
    sites.find((site) =>
      (site.aliases ?? []).some((alias) => alias.toLowerCase() === normalized),
    ) ??
    null
  );
}

export function dnsView(site: ProjectSite | null): RouteEntryView['dns'] {
  if (!site) return { state: 'unavailable', labelKey: 'envRoutesDnsUnavailable' };
  const dns = site.dns;
  if (!dns || !dns.checkedAt) {
    return { state: 'unavailable', labelKey: 'envRoutesDnsUnavailable' };
  }
  if (dns.status === 'resolved') {
    return {
      state: 'ready',
      labelKey: 'envRoutesDnsActive',
      detail: dns.checkedAt,
    };
  }
  return {
    state: 'blocked',
    labelKey: 'envRoutesDnsFailed',
    detail: dns.checkedAt,
  };
}

export function tlsView(site: ProjectSite | null): RouteEntryView['tls'] {
  if (!site) return { state: 'unavailable', labelKey: 'envRoutesTlsUnavailable' };
  const tls = site.tls;
  if (!tls) return { state: 'unavailable', labelKey: 'envRoutesTlsUnavailable' };
  const probe = tls.probe;
  if (probe && probe.checkedAt) {
    if (probe.status === 'valid') {
      return { state: 'ready', labelKey: 'envRoutesTlsValid', detail: probe.checkedAt };
    }
    if (probe.status === 'invalid') {
      return { state: 'blocked', labelKey: 'envRoutesTlsInvalid', detail: probe.checkedAt };
    }
  }
  if (tls.status === 'valid' || tls.status === 'active') {
    if (tls.expiresAt && new Date(tls.expiresAt).getTime() < Date.now()) {
      return { state: 'blocked', labelKey: 'envRoutesTlsExpired', detail: tls.expiresAt };
    }
    return { state: 'ready', labelKey: 'envRoutesTlsActive', detail: tls.expiresAt ?? undefined };
  }
  if (tls.status === 'invalid') {
    return { state: 'blocked', labelKey: 'envRoutesTlsInvalid' };
  }
  return { state: 'unavailable', labelKey: 'envRoutesTlsUnverified' };
}

export function probeView(
  site: ProjectSite | null,
  evidence: RouteEntryView['evidence'],
): RouteEntryView['probe'] {
  const http = evidence?.siteProbe?.http;
  if (http && http.checkedAt) {
    if (http.status === 'passed' && typeof http.statusCode === 'number') {
      return {
        state: 'ready',
        labelKey: 'envRoutesProbeHttp',
        detail: `${http.statusCode}`,
        checkedAt: http.checkedAt,
      };
    }
    if (http.status === 'passed') {
      return { state: 'ready', labelKey: 'envRoutesProbePassed', checkedAt: http.checkedAt };
    }
    return { state: 'blocked', labelKey: 'envRoutesProbeFailed', checkedAt: http.checkedAt };
  }
  if (site?.lastSyncAt) {
    return { state: 'ready', labelKey: 'envRoutesProbeSyncedAt', detail: site.lastSyncAt };
  }
  return { state: 'unavailable', labelKey: 'envRoutesProbeUnavailable' };
}

/**
 * AC-SET-049: the latest DeploymentRun carrying `result.siteProbe` evidence
 * for the drill-down (reuses the ReleaseSiteProbeEvidence renderer).
 */
/** F448 AC-SET-049: deep link to the deployment records view of the probe run. */
export function buildRouteProbeEvidenceHref(projectId: string, deploymentRunId: string): string {
  const query = new URLSearchParams({ view: 'deployments', runId: deploymentRunId });
  return `/projects/${encodeURIComponent(projectId)}?${query.toString()}`;
}

export { EMPTY_PROBE_EVIDENCE };
export { latestRouteProbeEvidence, parseRunProbeEvidence }
  from './settings-route-probe-evidence.model';
export type { RouteProbeEvidence } from './settings-route-probe-evidence.model';
export { dnsReadiness, routeReadiness, tlsReadiness }
  from './settings-route-readiness.model';
export type { RouteGateReadiness } from './settings-route-readiness.model';
