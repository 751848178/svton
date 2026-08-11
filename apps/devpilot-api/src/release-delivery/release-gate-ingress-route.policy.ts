import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { evaluated, unavailable } from "./release-gate-provider.types";
import { releaseGateIngressObservation } from "./release-gate-ingress-observation";

const INGRESS_TTL_MS = 60 * 60 * 1000;

export function evaluateIngressRoute(
  context: ReleaseGateEvidenceContext,
  now: Date,
) {
  const environment = context.promote?.environment;
  if (!environment) return missingRoute();
  const observation = releaseGateIngressObservation(context);
  const route = observation.route;
  if (!route) return missingRoute();
  if (route.reasonCode === "multiple_route_upstreams") {
    return evaluated({
      status: "blocked",
      reasonCode: route.reasonCode,
      zh: "当前路由 Provider 仅支持单一上游，入口包含多个不同上游",
      en: "The current route provider supports one upstream, but entries declare multiple upstreams",
      evidenceRef: context.promote?.releaseRun
        ? `release-run:${context.promote.releaseRun.id}#routeSnapshot.entries`
        : `environment-config-revision:${environment.currentConfigRevision?.id}#route.entries`,
      checkedAt: environment.currentConfigRevision?.createdAt ?? new Date(0),
      now,
    });
  }
  if (route.reasonCode !== "route_ready") return missingRoute();
  if (
    observation.reasonCode === "site_environment_mismatch" ||
    observation.reasonCode === "multiple_route_sites"
  ) {
    return evaluated({
      status: "blocked",
      reasonCode: observation.reasonCode,
      zh: "冻结入口域名的 Site 归属不唯一或跨环境",
      en: "Frozen ingress domain Site ownership is ambiguous or cross-environment",
      evidenceRef: context.promote?.releaseRun
        ? `release-run:${context.promote.releaseRun.id}#routeSnapshot`
        : `environment-config-revision:${environment.currentConfigRevision?.id}#route`,
      checkedAt: environment.currentConfigRevision?.createdAt ?? new Date(0),
      now,
    });
  }
  const site = observation.site;
  const status = site ? "checked" : "unchecked";
  return evaluated({
    status,
    reasonCode: status === "checked"
      ? "route_and_site_bound"
      : observation.reasonCode,
    zh: status === "checked"
      ? "Host、Path 与已验证上游已绑定活跃 Site"
      : "入口已配置已验证上游，但没有活跃 Site Provider 观测",
    en: status === "checked"
      ? "Host, path, and verified upstream are bound to an active Site"
      : "Entries have a verified upstream, but no active Site provider observation exists",
    evidenceRef: context.promote?.releaseRun
      ? `release-run:${context.promote.releaseRun.id}#routeSnapshot`
      : `environment-config-revision:${environment.currentConfigRevision?.id}#route`,
    checkedAt: site?.lastSyncAt ?? site?.updatedAt ??
      environment.currentConfigRevision?.createdAt ?? new Date(0),
    ttlMs: site ? INGRESS_TTL_MS : undefined,
    now,
  });
}

function missingRoute() {
  return unavailable(
    "route_binding_missing",
    "Production 配置没有包含已验证目标的完整 Host/Path/上游路由",
    "Production config has no complete Host/Path/upstream route with a verified target",
  );
}
