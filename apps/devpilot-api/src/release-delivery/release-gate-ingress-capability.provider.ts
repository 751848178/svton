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
import { releaseGateIngressObservation } from "./release-gate-ingress-observation";
import { evaluateIngressTls } from "./release-gate-ingress-tls.policy";

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
      context.promote?.sites.length || releaseGateIngressObservation(context).route,
    );
  }

  evaluate(
    definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    if (definition.id === "D14") return this.dns(context, now);
    if (definition.id === "D15") return evaluateIngressTls(context, now);
    return evaluateIngressRoute(context, now);
  }

  private dns(context: ReleaseGateEvidenceContext, now: Date) {
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
        zh: "Site/DNS 归属冲突，冻结域名无法唯一解析",
        en: "Site/DNS ownership conflicts prevent unique frozen-domain resolution",
        evidenceRef: `environment:${environment?.id ?? "missing"}#route-site`,
        checkedAt: environment?.currentConfigRevision?.createdAt ?? new Date(0),
        now,
      });
    }
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

}

function stale(iso: string, now: Date, ttlMs: number) {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return true;
  return now.getTime() - time > ttlMs;
}
