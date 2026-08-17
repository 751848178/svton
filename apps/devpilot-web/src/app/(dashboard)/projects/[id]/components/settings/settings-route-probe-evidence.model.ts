import type {
  ReleaseEvidenceRouteSwitch,
  ReleaseEvidenceSiteProbe,
} from '../../types/release-order-evidence.types';
import type { DeploymentRun } from '../../types/operations';

export type RouteProbeEvidence = {
  deploymentRunId: string;
  siteProbe: ReleaseEvidenceSiteProbe | null;
  routeSwitch: ReleaseEvidenceRouteSwitch | null;
};

export function latestRouteProbeEvidence(runs: DeploymentRun[]) {
  for (const run of runs) {
    const parsed = parseRunProbeEvidence(run);
    if (parsed) return parsed;
  }
  return null;
}

export function parseRunProbeEvidence(run: DeploymentRun): RouteProbeEvidence | null {
  const result = run.result as Record<string, unknown> | null | undefined;
  if (!result || typeof result !== 'object') return null;
  const siteProbe = objectValue(result.siteProbe);
  if (Object.keys(siteProbe).length === 0) return null;
  return {
    deploymentRunId: run.id,
    siteProbe: presentSiteProbe(siteProbe),
    routeSwitch: presentRouteSwitch(objectValue(result.routeSwitch)),
  };
}

function presentSiteProbe(raw: Record<string, unknown>): ReleaseEvidenceSiteProbe {
  const dns = objectValue(raw.dns);
  const tls = objectValue(raw.tls);
  const http = objectValue(raw.http);
  return {
    version: numberValue(raw.version), primaryDomain: stringValue(raw.primaryDomain),
    finalUrl: stringValue(raw.finalUrl), probedAt: stringValue(raw.probedAt),
    dns: { status: stringValue(dns.status), hostname: stringValue(dns.hostname),
      records: stringArray(dns.records), error: probeError(dns.error),
      checkedAt: stringValue(dns.checkedAt) },
    tls: { status: stringValue(tls.status), host: stringValue(tls.host),
      port: numberValue(tls.port), servername: stringValue(tls.servername),
      cert: tlsCert(tls.cert), error: probeError(tls.error),
      checkedAt: stringValue(tls.checkedAt) },
    http: { status: stringValue(http.status), url: stringValue(http.url),
      finalUrl: stringValue(http.finalUrl), statusCode: numberValue(http.statusCode),
      bodySignature: stringValue(http.bodySignature), error: probeError(http.error),
      checkedAt: stringValue(http.checkedAt) },
  };
}

function presentRouteSwitch(raw: Record<string, unknown>): ReleaseEvidenceRouteSwitch | null {
  if (Object.keys(raw).length === 0) return null;
  return {
    version: numberValue(raw.version), siteId: stringValue(raw.siteId),
    primaryDomain: stringValue(raw.primaryDomain),
    deploymentRunId: stringValue(raw.deploymentRunId),
    releaseRunId: stringValue(raw.releaseRunId), targetRef: stringValue(raw.targetRef),
    proxyTarget: stringValue(raw.proxyTarget), domains: stringArray(raw.domains),
    status: stringValue(raw.status), reasonCode: stringValue(raw.reasonCode),
    switchedAt: stringValue(raw.switchedAt),
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function stringValue(value: unknown) { return typeof value === 'string' && value ? value : null; }
function numberValue(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function stringArray(value: unknown) {
  if (!Array.isArray(value)) return null;
  const items = value.filter((item): item is string => typeof item === 'string');
  return items.length > 0 ? items : null;
}
function probeError(value: unknown) {
  const raw = objectValue(value); const code = stringValue(raw.code);
  return code ? { code, message: stringValue(raw.message) ?? '' } : null;
}
function tlsCert(value: unknown): ReleaseEvidenceSiteProbe['tls']['cert'] {
  const raw = objectValue(value);
  return Object.keys(raw).length === 0 ? null : {
    subject: stringValue(raw.subject), issuer: stringValue(raw.issuer),
    validFrom: stringValue(raw.validFrom), validUntil: stringValue(raw.validUntil),
    expired: typeof raw.expired === 'boolean' ? raw.expired : null,
  };
}
