import type { FrozenRouteSnapshot } from "../site/site-route-activation.types";
import { resolveFrozenRoute } from "../site/site-route-snapshot.policy";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { evaluated, unavailable } from "./release-gate-provider.types";

const INGRESS_TTL_MS = 60 * 60 * 1000;

export function evaluateIngressRoute(
  context: ReleaseGateEvidenceContext,
  now: Date,
) {
  const environment = context.promote?.environment;
  const revision = environment?.currentConfigRevision;
  if (!environment || !revision) return missingRoute();
  const snapshot = routeSnapshot(
    revision.routeSnapshot ?? context.promote?.releaseRun?.routeSnapshot,
  );
  if (!snapshot) return missingRoute();
  const route = resolveFrozenRoute(snapshot);
  if (route.reasonCode === "multiple_route_upstreams") {
    return evaluated({
      status: "blocked",
      reasonCode: route.reasonCode,
      zh: "当前路由 Provider 仅支持单一上游，入口包含多个不同上游",
      en: "The current route provider supports one upstream, but entries declare multiple upstreams",
      evidenceRef: `environment-config-revision:${revision.id}#route.entries`,
      checkedAt: revision.createdAt,
      now,
    });
  }
  if (route.reasonCode !== "route_ready") return missingRoute();
  const site = context.promote?.sites.find((item) =>
    route.domains.includes(item.primaryDomain),
  );
  const status = site?.status === "active" ? "checked" : "unchecked";
  return evaluated({
    status,
    reasonCode: status === "checked"
      ? "route_and_site_bound"
      : "route_site_not_observed",
    zh: status === "checked"
      ? "Host、Path 与已验证上游已绑定活跃 Site"
      : "入口已配置已验证上游，但没有活跃 Site Provider 观测",
    en: status === "checked"
      ? "Host, path, and verified upstream are bound to an active Site"
      : "Entries have a verified upstream, but no active Site provider observation exists",
    evidenceRef: `environment-config-revision:${revision.id}#route`,
    checkedAt: site?.lastSyncAt ?? site?.updatedAt ?? revision.createdAt,
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

function routeSnapshot(value: unknown): FrozenRouteSnapshot | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as FrozenRouteSnapshot
    : null;
}
