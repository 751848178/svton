// F438: fail-closed policy for real site probes.
// A definitive negative (expired/invalid TLS cert, non-2xx HTTP on a reachable URL)
// must never let a Production run be marked successful. An explicit `unavailable`
// (provider/network absence) is honest and recorded, but is NOT a pass either.
import type { SiteProbeResult } from "./site-route-activation.types";

export class SiteProbePolicyError extends Error {
  constructor(
    readonly detail: {
      code: string;
      message: string;
      logs: string[];
      evidence: Record<string, unknown>;
    },
  ) {
    super(detail.message);
    this.name = "SiteProbePolicyError";
  }
}

export class SiteRouteActivationError extends Error {
  constructor(
    readonly detail: {
      code: string;
      message: string;
      evidence: Record<string, unknown>;
    },
  ) {
    super(detail.message);
    this.name = "SiteRouteActivationError";
  }
}

export function assertSiteProbeAcceptable(
  probe: SiteProbeResult,
  routeSwitch: Record<string, unknown>,
) {
  if (probe.tls.status === "invalid") {
    throw new SiteProbePolicyError({
      code: "SITE_TLS_CERTIFICATE_INVALID",
      message: "Production 站点 TLS 证书无效或已过期，禁止标记成功",
      logs: [],
      evidence: { siteProbe: probe, routeSwitch },
    });
  }
  if (probe.http.status === "failed") {
    throw new SiteProbePolicyError({
      code: "SITE_HTTP_PROBE_FAILED",
      message: "Production 站点 HTTP 探测返回失败状态，禁止标记成功",
      logs: [],
      evidence: { siteProbe: probe, routeSwitch },
    });
  }
  if (routeSwitch.status === "failed") {
    throw new SiteProbePolicyError({
      code: "SITE_ROUTE_SWITCH_FAILED",
      message: "Production 路由切换失败，禁止标记成功",
      logs: [],
      evidence: { siteProbe: probe, routeSwitch },
    });
  }
}

export function extractSiteEvidence(error: unknown): Record<string, unknown> {
  if (error instanceof SiteProbePolicyError) return error.detail.evidence;
  if (error instanceof SiteRouteActivationError) return error.detail.evidence;
  return {};
}
