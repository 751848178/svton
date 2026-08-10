// F438: fail-closed policy for real site probes.
// A definitive negative (expired/invalid TLS cert, non-2xx HTTP on a reachable URL)
// must never let a Production run be marked successful. An explicit `unavailable`
// (provider/network absence) is honest and recorded, but is NOT a pass either.
import type { SiteProbeResult } from "./site-route-activation.types";
import { normalizeFinalUrl } from "./site-final-url";

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
  if (routeSwitch.status !== "switched") {
    deny(
      "SITE_ROUTE_SWITCH_UNVERIFIED",
      "Production 路由没有可验证的 switched receipt，禁止标记成功",
      probe,
      routeSwitch,
    );
  }
  const finalUrl = normalizeFinalUrl(probe.finalUrl);
  if (!finalUrl) {
    deny(
      "SITE_FINAL_URL_MISSING",
      "Production 站点缺少有效 final URL，禁止标记成功",
      probe,
      routeSwitch,
    );
  }
  if (probe.dns.status !== "resolved") {
    deny(
      "SITE_DNS_PROBE_UNAVAILABLE",
      "Production 站点 DNS 尚未解析成功，禁止标记成功",
      probe,
      routeSwitch,
    );
  }
  if (finalUrl.startsWith("https:") && probe.tls.status !== "valid") {
    deny(
      probe.tls.status === "invalid"
        ? "SITE_TLS_CERTIFICATE_INVALID"
        : "SITE_TLS_PROBE_UNAVAILABLE",
      "Production 站点 TLS 证据未通过，禁止标记成功",
      probe,
      routeSwitch,
    );
  }
  const observedUrl = normalizeFinalUrl(probe.http.url);
  const recordedFinalUrl = normalizeFinalUrl(probe.http.finalUrl);
  if (observedUrl !== finalUrl || recordedFinalUrl !== finalUrl) {
    deny(
      "SITE_HTTP_FINAL_URL_MISMATCH",
      "Production HTTP 证据不是精确 final URL，禁止标记成功",
      probe,
      routeSwitch,
    );
  }
  if (probe.http.status !== "passed") {
    deny(
      probe.http.status === "unavailable"
        ? "SITE_HTTP_PROBE_UNAVAILABLE"
        : "SITE_HTTP_PROBE_FAILED",
      "Production 站点 HTTP 探测未通过，禁止标记成功",
      probe,
      routeSwitch,
    );
  }
  const statusCode = probe.http.statusCode;
  if (typeof statusCode !== "number" || statusCode < 200 || statusCode >= 300) {
    deny(
      "SITE_HTTP_STATUS_INVALID",
      "Production 站点 HTTP 证据不是 2xx，禁止标记成功",
      probe,
      routeSwitch,
    );
  }
}

function deny(
  code: string,
  message: string,
  probe: SiteProbeResult,
  routeSwitch: Record<string, unknown>,
): never {
  throw new SiteProbePolicyError({
    code,
    message,
    logs: [],
    evidence: { siteProbe: probe, routeSwitch },
  });
}

export function extractSiteEvidence(error: unknown): Record<string, unknown> {
  if (error instanceof SiteProbePolicyError) return error.detail.evidence;
  if (error instanceof SiteRouteActivationError) return error.detail.evidence;
  return {};
}
