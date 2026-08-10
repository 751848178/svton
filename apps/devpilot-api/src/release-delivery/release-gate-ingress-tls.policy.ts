import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { releaseGateIngressObservation } from "./release-gate-ingress-observation";
import { evaluated, record, unavailable } from "./release-gate-provider.types";

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
      });
    }
    return unavailable(
      "tls_probe_unavailable",
      "Production TLS 真实探测未完成，不视为通过",
      "Production real TLS probe is unavailable; not counted as a pass",
    );
  }
  const expiresAt = dateValue(tls.expiresAt);
  const expired = Boolean(expiresAt && expiresAt.getTime() < now.getTime());
  const certValid =
    site.environmentId === environment.id &&
    (tls.status === "valid" || tls.status === "active") &&
    !expired;
  if (!certValid) {
    if (
      site.environmentId !== environment.id ||
      expired ||
      tls.status === "invalid"
    ) {
      return evaluated({
        status: "blocked",
        reasonCode:
          site.environmentId !== environment.id
            ? "site_environment_mismatch"
            : expired
              ? "tls_certificate_expired"
              : "tls_certificate_invalid",
        zh: expired ? "TLS 证书已过期" : "TLS 证书状态无效",
        en: expired
          ? "TLS certificate is expired"
          : "TLS certificate status is invalid",
        evidenceRef: `site:${site.id}#tls`,
        checkedAt: site.lastSyncAt ?? site.updatedAt,
        ttlMs: INGRESS_TTL_MS,
        now,
      });
    }
    return evaluated({
      status: "unchecked",
      reasonCode: "tls_certificate_unverified",
      zh: "TLS 证书状态未验证",
      en: "TLS certificate status is unverified",
      evidenceRef: `site:${site.id}#tls`,
      checkedAt: site.lastSyncAt ?? site.updatedAt,
      ttlMs: INGRESS_TTL_MS,
      now,
    });
  }
  return evaluated({
    status: "checked",
    reasonCode: "tls_certificate_valid",
    zh: "TLS 证书状态和有效期已验证",
    en: "TLS certificate status and expiry are verified",
    evidenceRef: `site:${site.id}#tls`,
    checkedAt: site.lastSyncAt ?? site.updatedAt,
    ttlMs: INGRESS_TTL_MS,
    now,
  });
}

function dateValue(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stale(iso: string, now: Date, ttlMs: number) {
  const time = new Date(iso).getTime();
  return Number.isNaN(time) || now.getTime() - time > ttlMs;
}
