import { Injectable } from "@nestjs/common";
import type {
  ReleaseGateCapabilityId,
  ReleaseGateDefinition,
  ReleaseGateStatus,
} from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import {
  evaluated,
  record,
  type ReleaseGateCapabilityProvider,
  unavailable,
} from "./release-gate-provider.types";

const INGRESS_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class ReleaseGateIngressCapabilityProvider
implements ReleaseGateCapabilityProvider {
  readonly providerKey = "site_dns_tls_route";
  readonly capabilityIds: ReleaseGateCapabilityId[] = ["M11"];

  available(
    _capabilityId: ReleaseGateCapabilityId,
    context: ReleaseGateEvidenceContext,
  ) {
    return Boolean(context.promote?.sites.length
      || Object.keys(this.route(context)).length);
  }

  evaluate(
    definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    if (definition.id === "D14") return this.dns(context, now);
    if (definition.id === "D15") return this.tls(context, now);
    return this.routeBinding(context, now);
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
    const scoped = site.environmentId === environment.id;
    const checked = scoped && site.status === "active" && Boolean(site.lastSyncAt);
    const status: ReleaseGateStatus = !scoped || site.status === "error"
      ? "blocked" : checked ? "checked" : "unchecked";
    return evaluated({
      status,
      reasonCode: !scoped ? "site_environment_mismatch"
        : checked ? "dns_site_active" : site.status === "error" ? "dns_site_error" : "dns_site_not_synced",
      zh: checked ? `域名 ${site.primaryDomain} 已由 Site Provider 同步` : "Site/DNS 同步失败、未完成或环境归属不符",
      en: checked ? `Domain ${site.primaryDomain} was synchronized by the Site provider` : "Site/DNS sync failed, is incomplete, or has wrong environment ownership",
      evidenceRef: `site:${site.id};environment:${environment.id}`,
      checkedAt: site.lastSyncAt ?? site.updatedAt,
      ttlMs: INGRESS_TTL_MS,
      now,
    });
  }

  private tls(context: ReleaseGateEvidenceContext, now: Date) {
    const environment = context.promote?.environment;
    const site = context.promote?.sites[0];
    if (!environment || !site) {
      return unavailable("tls_provider_missing", "Production 没有 TLS Provider 证据", "Production has no TLS provider evidence");
    }
    const tls = record(site.tls);
    if (Object.keys(tls).length === 0) {
      return unavailable("tls_evidence_missing", "Site 未提供证书状态与有效期", "Site did not provide certificate status and expiry");
    }
    const expiresAt = dateValue(tls.expiresAt);
    const expired = Boolean(expiresAt && expiresAt.getTime() < now.getTime());
    const valid = site.environmentId === environment.id
      && (tls.status === "valid" || tls.status === "active") && !expired;
    const status: ReleaseGateStatus = valid
      ? "checked" : expired || tls.status === "invalid" ? "blocked" : "unchecked";
    return evaluated({
      status,
      reasonCode: valid ? "tls_certificate_valid" : expired ? "tls_certificate_expired" : "tls_certificate_unverified",
      zh: valid ? "TLS 证书状态和有效期已验证" : expired ? "TLS 证书已过期" : "TLS 证书状态未验证",
      en: valid ? "TLS certificate status and expiry are verified" : expired ? "TLS certificate is expired" : "TLS certificate status is unverified",
      evidenceRef: `site:${site.id}#tls`,
      checkedAt: site.lastSyncAt ?? site.updatedAt,
      ttlMs: INGRESS_TTL_MS,
      now,
    });
  }

  private routeBinding(context: ReleaseGateEvidenceContext, now: Date) {
    const environment = context.promote?.environment;
    const revision = environment?.currentConfigRevision;
    const route = this.route(context);
    const domains = Array.isArray(route.domains)
      ? route.domains.filter((item) => typeof item === "string") : [];
    const proxy = typeof route.proxyTarget === "string" && route.proxyTarget.length > 0;
    if (!environment || !revision || domains.length === 0 || !proxy) {
      return unavailable(
        "route_binding_missing",
        "Production 配置没有完整 Host/Path/上游路由",
        "Production config has no complete Host/Path/upstream route",
      );
    }
    const site = context.promote?.sites.find((item) =>
      domains.includes(item.primaryDomain));
    const status: ReleaseGateStatus = site?.status === "active" ? "checked" : "unchecked";
    return evaluated({
      status,
      reasonCode: status === "checked" ? "route_and_site_bound" : "route_site_not_observed",
      zh: status === "checked" ? "Host 与上游路由已绑定活跃 Site" : "路由已配置，但没有活跃 Site Provider 观测",
      en: status === "checked" ? "Host and upstream route are bound to an active Site" : "Route is configured, but no active Site provider observation exists",
      evidenceRef: `environment-config-revision:${revision.id}#route`,
      checkedAt: site?.lastSyncAt ?? site?.updatedAt ?? revision.createdAt,
      ttlMs: site ? INGRESS_TTL_MS : undefined,
      now,
    });
  }

  private route(context: ReleaseGateEvidenceContext) {
    return record(context.promote?.environment?.currentConfigRevision?.routeSnapshot
      ?? context.promote?.releaseRun?.routeSnapshot);
  }
}

function dateValue(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
