import type { SiteProbeResult } from "./site-route-activation.types";
import {
  assertSiteProbeAcceptable,
  SiteProbePolicyError,
} from "./site-probe-policy";

describe("site probe completion policy", () => {
  it("accepts exact final URL 2xx evidence with all required proofs", () => {
    expect(() => assertSiteProbeAcceptable(probe(), switched())).not.toThrow();
  });

  it.each([
    ["missing final URL", { finalUrl: null }, "SITE_FINAL_URL_MISSING"],
    [
      "unavailable HTTP",
      { http: { status: "unavailable" } },
      "SITE_HTTP_PROBE_UNAVAILABLE",
    ],
    [
      "404",
      { http: { status: "failed", statusCode: 404 } },
      "SITE_HTTP_PROBE_FAILED",
    ],
    [
      "500",
      { http: { status: "failed", statusCode: 500 } },
      "SITE_HTTP_PROBE_FAILED",
    ],
    [
      "URL mismatch",
      { http: { url: "https://proxy.example/" } },
      "SITE_HTTP_FINAL_URL_MISMATCH",
    ],
    [
      "DNS unavailable",
      { dns: { status: "unavailable" } },
      "SITE_DNS_PROBE_UNAVAILABLE",
    ],
    [
      "TLS unavailable",
      { tls: { status: "unavailable" } },
      "SITE_TLS_PROBE_UNAVAILABLE",
    ],
  ])("blocks %s", (_label, override, code) => {
    const candidate = deepMerge(probe(), override as Partial<SiteProbeResult>);
    expectPolicyCode(
      () => assertSiteProbeAcceptable(candidate, switched()),
      code,
    );
  });

  it.each(["unavailable", "failed"])(
    "blocks a %s route-switch proof before completion",
    (status) => {
      expectPolicyCode(
        () => assertSiteProbeAcceptable(probe(), { status }),
        "SITE_ROUTE_SWITCH_UNVERIFIED",
      );
    },
  );
});

function probe(): SiteProbeResult {
  const checkedAt = "2026-08-08T00:00:00.000Z";
  const finalUrl = "https://release.example/";
  return {
    version: 1,
    primaryDomain: "release.example",
    finalUrl,
    probedAt: checkedAt,
    dns: { status: "resolved", hostname: "release.example", checkedAt },
    tls: { status: "valid", host: "release.example", checkedAt },
    http: {
      status: "passed",
      url: finalUrl,
      finalUrl,
      statusCode: 200,
      bodySignature: "sha256:proof",
      checkedAt,
    },
  };
}

function switched() {
  return { status: "switched" };
}

function deepMerge(
  value: SiteProbeResult,
  override: Partial<SiteProbeResult>,
): SiteProbeResult {
  return {
    ...value,
    ...override,
    dns: { ...value.dns, ...override.dns },
    tls: { ...value.tls, ...override.tls },
    http: { ...value.http, ...override.http },
  };
}

function expectPolicyCode(action: () => void, code: string) {
  try {
    action();
    throw new Error("expected site probe policy rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(SiteProbePolicyError);
    expect((error as SiteProbePolicyError).detail.code).toBe(code);
  }
}
