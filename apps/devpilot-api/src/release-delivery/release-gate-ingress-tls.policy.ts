import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { releaseGateIngressObservation } from "./release-gate-ingress-observation";
import { evaluated, record, unavailable } from "./release-gate-provider.types";
import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";

const INGRESS_TTL_MS = 60 * 60 * 1000;

export function evaluateIngressTls(
  context: ReleaseGateEvidenceContext,
  now: Date,
) {
  const environment = context.promote?.environment;
  const observation = releaseGateIngressObservation(context);
  const site = observation.site;
  if (
    observation.reasonCode === "site_environment_mismatch" ||
    observation.reasonCode === "multiple_route_sites"
  ) {
    return evaluated({
      status: "blocked",
      reasonCode: observation.reasonCode,
      zh: "Site/TLS 归属冲突，冻结域名无法唯一解析",
      en: "Site/TLS ownership conflicts prevent unique frozen-domain resolution",
      evidenceRef: `environment:${environment?.id ?? "missing"}#route-site`,
      checkedAt: environment?.currentConfigRevision?.createdAt ?? new Date(0),
      now,
    });
  }
  if (!environment || !site) {
    return unavailable(
      "tls_provider_missing",
      "Production 没有 TLS Provider 证据",
      "Production has no TLS provider evidence",
    );
  }
  const tls = record(site.tls);
  if (Object.keys(tls).length === 0) {
    return unavailable(
      "tls_evidence_missing",
      "Site 未提供证书状态与有效期",
      "Site did not provide certificate status and expiry",
    );
  }
  const probe = record(tls.probe);
  const probeCheckedAt = probe.checkedAt;
  const probeHostname = typeof probe.host === "string"
    ? probe.host.toLowerCase() : "";
  const exactHostname = observation.route?.domains.some((domain) =>
    domain.toLowerCase() === probeHostname) &&
    probe.servername === probe.host;
  if (Object.keys(probe).length > 0 && !exactHostname) {
    return unavailable(
      "tls_probe_scope_mismatch",
      "TLS 探测 SNI/域名与冻结路由不一致",
      "The TLS probe SNI/hostname does not match the frozen route",
    );
  }
  if (
    typeof probeCheckedAt === "string" &&
    !stale(probeCheckedAt, now, INGRESS_TTL_MS)
  ) {
    if (probe.status === "invalid") {
      return evaluated({
        status: "blocked",
        reasonCode: "tls_certificate_invalid",
        zh: "Production TLS 真实握手证书无效或已过期",
        en: "The Production TLS real handshake certificate is invalid or expired",
        evidenceRef: `site:${site.id}#tls.probe`,
        checkedAt: new Date(probeCheckedAt),
        ttlMs: INGRESS_TTL_MS,
        now,
        evidenceIdentity: ingressIdentity(environment, site, probeHostname),
      });
    }
    if (probe.status === "valid") {
      return evaluated({
        status: "checked",
        reasonCode: "tls_certificate_valid",
        zh: "TLS 真实握手证书有效",
        en: "TLS real handshake certificate is valid",
        evidenceRef: `site:${site.id}#tls.probe`,
        checkedAt: new Date(probeCheckedAt),
        ttlMs: INGRESS_TTL_MS,
        now,
        evidenceIdentity: ingressIdentity(environment, site, probeHostname),
      });
    }
    return unavailable(
      "tls_probe_unavailable",
      "Production TLS 真实探测未完成，不视为通过",
      "Production real TLS probe is unavailable; not counted as a pass",
    );
  }
  if (typeof probeCheckedAt === "string") {
    return evaluated({
      status: "checked",
      reasonCode: "tls_certificate_valid",
      zh: "TLS 真实握手证据已过期",
      en: "The real TLS handshake evidence is stale",
      evidenceRef: `site:${site.id}#tls.probe`,
      checkedAt: new Date(probeCheckedAt),
      ttlMs: INGRESS_TTL_MS,
      now,
      evidenceIdentity: ingressIdentity(environment, site, probeHostname),
    });
  }
  const expiresAt = dateValue(tls.expiresAt);
  const expired = Boolean(expiresAt && expiresAt.getTime() < now.getTime());
  if (site.environmentId !== environment.id || expired || tls.status === "invalid") {
    return evaluated({
      status: "blocked",
      reasonCode: site.environmentId !== environment.id
        ? "site_environment_mismatch"
        : expired ? "tls_certificate_expired" : "tls_certificate_invalid",
      zh: expired ? "TLS 证书已过期" : "TLS 证书状态无效",
      en: expired ? "TLS certificate is expired" : "TLS certificate status is invalid",
      evidenceRef: `site:${site.id}#tls`,
      checkedAt: site.lastSyncAt ?? site.updatedAt,
      ttlMs: INGRESS_TTL_MS,
      now,
    });
  }
  return unavailable(
    "tls_certificate_unverified",
    "TLS 必须由服务端真实握手探测验证，配置状态不作为发布证据",
    "TLS requires a server-owned handshake probe; configured status is not release evidence",
  );
}

function dateValue(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ingressIdentity(
  environment: NonNullable<ReleaseGateEvidenceContext["promote"]>["environment"],
  site: { id: string; environmentId: string | null; primaryDomain: string },
  hostname: string,
) {
  return { siteId: site.id, environmentId: environment!.id,
    hostname,
    routeHash: hashCanonicalReleaseValue(record(
      environment!.currentConfigRevision?.routeSnapshot,
    )) };
}

function stale(iso: string, now: Date, ttlMs: number) {
  const time = new Date(iso).getTime();
  return Number.isNaN(time) || now.getTime() - time > ttlMs;
}
