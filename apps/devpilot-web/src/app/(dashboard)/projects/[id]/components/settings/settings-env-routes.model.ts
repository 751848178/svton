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

export const ROUTE_TLS_MODES = ['managed_cert', 'existing_cert_asset'] as const;
export type RouteTlsMode = (typeof ROUTE_TLS_MODES)[number];

export type RouteProbeState = 'ready' | 'blocked' | 'unavailable';
export type RouteGateState = 'ready' | 'blocked' | 'unavailable';

export type RouteGateReadiness = {
  state: RouteGateState;
  labelKey: string;
  detailKey?: string;
};

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
        d15: tlsReadiness(site),
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
 * AC-SET-048: per-entry gate readiness derived from the persisted Site probe
 * data with the same fail-closed policy as the D14/D15/D16 production gate
 * (release-gate-ingress-capability.provider.ts): anything not provably ready
 * is blocked (real evidence present but failing) or unavailable (evidence
 * absent), never silently passed.
 */
export function dnsReadiness(site: ProjectSite | null): RouteGateReadiness {
  if (!site) return { state: 'unavailable', labelKey: 'envRoutesGateUnavailable', detailKey: 'envRoutesReasonDnsSiteMissing' };
  const dns = site.dns;
  if (!dns || !dns.checkedAt) {
    return { state: 'unavailable', labelKey: 'envRoutesGateUnavailable', detailKey: 'envRoutesReasonDnsProbeMissing' };
  }
  if (dns.status === 'resolved') return { state: 'ready', labelKey: 'envRoutesGateReady' };
  return { state: 'blocked', labelKey: 'envRoutesGateBlocked', detailKey: 'envRoutesReasonDnsFailed' };
}

export function tlsReadiness(site: ProjectSite | null): RouteGateReadiness {
  if (!site) return { state: 'unavailable', labelKey: 'envRoutesGateUnavailable', detailKey: 'envRoutesReasonTlsSiteMissing' };
  const tls = site.tls;
  if (!tls) return { state: 'unavailable', labelKey: 'envRoutesGateUnavailable', detailKey: 'envRoutesReasonTlsMissing' };
  const probe = tls.probe;
  if (probe && probe.checkedAt) {
    if (probe.status === 'valid') return { state: 'ready', labelKey: 'envRoutesGateReady' };
    if (probe.status === 'invalid') {
      return { state: 'blocked', labelKey: 'envRoutesGateBlocked', detailKey: 'envRoutesReasonTlsInvalid' };
    }
    return { state: 'unavailable', labelKey: 'envRoutesGateUnavailable', detailKey: 'envRoutesReasonTlsProbeUnavailable' };
  }
  if (tls.status === 'valid' || tls.status === 'active') {
    if (tls.expiresAt && new Date(tls.expiresAt).getTime() < Date.now()) {
      return { state: 'blocked', labelKey: 'envRoutesGateBlocked', detailKey: 'envRoutesReasonTlsExpired' };
    }
    return { state: 'ready', labelKey: 'envRoutesGateReady' };
  }
  if (tls.status === 'invalid') {
    return { state: 'blocked', labelKey: 'envRoutesGateBlocked', detailKey: 'envRoutesReasonTlsInvalid' };
  }
  return { state: 'unavailable', labelKey: 'envRoutesGateUnavailable', detailKey: 'envRoutesReasonTlsUnverified' };
}

export function routeReadiness(site: ProjectSite | null): RouteGateReadiness {
  if (!site) return { state: 'unavailable', labelKey: 'envRoutesGateUnavailable', detailKey: 'envRoutesReasonRouteSiteMissing' };
  if (site.status === 'active') return { state: 'ready', labelKey: 'envRoutesGateReady' };
  if (site.status === 'error') {
    return { state: 'blocked', labelKey: 'envRoutesGateBlocked', detailKey: 'envRoutesReasonRouteSiteError' };
  }
  return { state: 'unavailable', labelKey: 'envRoutesGateUnavailable', detailKey: 'envRoutesReasonRouteSiteNotObserved' };
}

/**
 * AC-SET-049: the latest DeploymentRun carrying `result.siteProbe` evidence
 * for the drill-down (reuses the ReleaseSiteProbeEvidence renderer).
 */
export function latestRouteProbeEvidence(
  runs: DeploymentRun[],
): RouteEntryView['evidence'] {
  for (const run of runs) {
    const parsed = parseRunProbeEvidence(run);
    if (parsed) return parsed;
  }
  return null;
}

export type RouteProbeEvidence = NonNullable<RouteEntryView['evidence']>;

export function parseRunProbeEvidence(run: DeploymentRun): RouteProbeEvidence | null {
  const result = run.result as Record<string, unknown> | null | undefined;
  if (!result || typeof result !== 'object') return null;
  const siteProbeRaw = result.siteProbe as Record<string, unknown> | undefined;
  const routeSwitchRaw = result.routeSwitch as Record<string, unknown> | undefined;
  if (!siteProbeRaw || typeof siteProbeRaw !== 'object') return null;
  return {
    deploymentRunId: run.id,
    siteProbe: presentSiteProbe(siteProbeRaw),
    routeSwitch: presentRouteSwitch(routeSwitchRaw),
  };
}

function presentSiteProbe(raw: Record<string, unknown>): ReleaseEvidenceSiteProbe {
  const dns = objectValue(raw.dns);
  const tls = objectValue(raw.tls);
  const http = objectValue(raw.http);
  return {
    version: numberValue(raw.version),
    primaryDomain: stringValue(raw.primaryDomain),
    finalUrl: stringValue(raw.finalUrl),
    probedAt: stringValue(raw.probedAt),
    dns: {
      status: stringValue(dns.status),
      hostname: stringValue(dns.hostname),
      records: stringArray(dns.records),
      error: probeError(dns.error),
      checkedAt: stringValue(dns.checkedAt),
    },
    tls: {
      status: stringValue(tls.status),
      host: stringValue(tls.host),
      port: numberValue(tls.port),
      servername: stringValue(tls.servername),
      cert: tlsCert(tls.cert),
      error: probeError(tls.error),
      checkedAt: stringValue(tls.checkedAt),
    },
    http: {
      status: stringValue(http.status),
      url: stringValue(http.url),
      finalUrl: stringValue(http.finalUrl),
      statusCode: numberValue(http.statusCode),
      bodySignature: stringValue(http.bodySignature),
      error: probeError(http.error),
      checkedAt: stringValue(http.checkedAt),
    },
  };
}

function presentRouteSwitch(raw: Record<string, unknown> | undefined): ReleaseEvidenceRouteSwitch | null {
  if (!raw) return null;
  return {
    version: numberValue(raw.version),
    siteId: stringValue(raw.siteId),
    primaryDomain: stringValue(raw.primaryDomain),
    deploymentRunId: stringValue(raw.deploymentRunId),
    releaseRunId: stringValue(raw.releaseRunId),
    targetRef: stringValue(raw.targetRef),
    proxyTarget: stringValue(raw.proxyTarget),
    domains: stringArray(raw.domains),
    status: stringValue(raw.status),
    reasonCode: stringValue(raw.reasonCode),
    switchedAt: stringValue(raw.switchedAt),
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.filter((item): item is string => typeof item === 'string');
  return items.length > 0 ? items : null;
}

function probeError(value: unknown): { code: string; message: string } | null {
  const raw = objectValue(value);
  const code = stringValue(raw.code);
  if (!code) return null;
  return { code, message: stringValue(raw.message) ?? '' };
}

function tlsCert(
  value: unknown,
): ReleaseEvidenceSiteProbe['tls']['cert'] {
  const raw = objectValue(value);
  if (Object.keys(raw).length === 0) return null;
  return {
    subject: stringValue(raw.subject),
    issuer: stringValue(raw.issuer),
    validFrom: stringValue(raw.validFrom),
    validUntil: stringValue(raw.validUntil),
    expired: typeof raw.expired === 'boolean' ? raw.expired : null,
  };
}

/** F448 AC-SET-049: deep link to the deployment records view of the probe run. */
export function buildRouteProbeEvidenceHref(projectId: string, deploymentRunId: string): string {
  const query = new URLSearchParams({ view: 'deployments', runId: deploymentRunId });
  return `/projects/${encodeURIComponent(projectId)}?${query.toString()}`;
}

export { EMPTY_PROBE_EVIDENCE };
