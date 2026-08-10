import { Injectable } from "@nestjs/common";
import type {
  ReleaseGateCapabilityId,
  ReleaseGateDefinition,
} from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import {
  evaluated,
  record,
  type ReleaseGateCapabilityProvider,
  unavailable,
} from "./release-gate-provider.types";
import { evaluateIngressRoute } from "./release-gate-ingress-route.policy";

const INGRESS_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class ReleaseGateIngressCapabilityProvider implements ReleaseGateCapabilityProvider {
  readonly providerKey = "site_dns_tls_route";
  readonly capabilityIds: ReleaseGateCapabilityId[] = ["M11"];

  available(
    _capabilityId: ReleaseGateCapabilityId,
    context: ReleaseGateEvidenceContext,
  ) {
    return Boolean(
      context.promote?.sites.length || Object.keys(this.route(context)).length,
    );
  }

  evaluate(
    definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    if (definition.id === "D14") return this.dns(context, now);
    if (definition.id === "D15") return this.tls(context, now);
    return evaluateIngressRoute(context, now);
  }

  private dns(context: ReleaseGateEvidenceContext, now: Date) {
    const environment = context.promote?.environment;
    const site = context.promote?.sites[0];
    if (!environment || !site) {
      return unavailable(
        "dns_provider_missing",
        "Production 没有 Site/DNS Provider 同步证据",
        "Production has no Site/DNS provider sync evidence",
      );
    }
    if (site.environmentId !== environment.id || site.status === "error") {
      return evaluated({
        status: "blocked",
        reasonCode:
          site.environmentId !== environment.id
            ? "site_environment_mismatch"
            : "dns_site_error",
        zh: "Site/DNS 环境归属不符或站点状态错误",
        en: "Site/DNS environment ownership is wrong or the site is in error",
        evidenceRef: `site:${site.id};environment:${environment.id}`,
        checkedAt: site.lastSyncAt ?? site.updatedAt,
        ttlMs: INGRESS_TTL_MS,
        now,
      });
    }
    const dns = record(site.dns);
    const checkedAt = dns.checkedAt;
    if (
      typeof checkedAt !== "string" ||
      stale(checkedAt, now, INGRESS_TTL_MS)
    ) {
      return unavailable(
        "dns_probe_missing",
        "没有新鲜的 Production DNS 真实探测结果",
        "No fresh real Production DNS probe result",
      );
    }
    if (dns.status === "resolved") {
      return evaluated({
        status: "checked",
        reasonCode: "dns_site_resolved",
        zh: `域名 ${site.primaryDomain} 真实解析为 ${Array.isArray(dns.records) ? dns.records.join(", ") : "记录"}`,
        en: `Domain ${site.primaryDomain} resolved to ${Array.isArray(dns.records) ? dns.records.join(", ") : "records"} by a real DNS lookup`,
        evidenceRef: `site:${site.id}#dns`,
        checkedAt: new Date(checkedAt),
        ttlMs: INGRESS_TTL_MS,
        now,
      });
    }
    return unavailable(
      "dns_probe_unavailable",
      "Production DNS 真实探测未完成（域名不可解析或网络不可用），不视为通过",
      "Production real DNS probe is unavailable (domain not resolvable or network down); not counted as a pass",
    );
  }

  private tls(context: ReleaseGateEvidenceContext, now: Date) {
    const environment = context.promote?.environment;
    const site = context.promote?.sites[0];
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
    if (Object.keys(probe).length > 0) {
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

  private route(context: ReleaseGateEvidenceContext) {
    return record(
      context.promote?.environment?.currentConfigRevision?.routeSnapshot ??
        context.promote?.releaseRun?.routeSnapshot,
    );
  }
}

function dateValue(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stale(iso: string, now: Date, ttlMs: number) {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return true;
  return now.getTime() - time > ttlMs;
}
