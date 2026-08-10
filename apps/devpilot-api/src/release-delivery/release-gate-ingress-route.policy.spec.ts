import { evaluateIngressRoute } from "./release-gate-ingress-route.policy";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";

const NOW = new Date("2026-08-10T00:00:00.000Z");

describe("evaluateIngressRoute D16", () => {
  it("checks structured entries with a verified target and ignores legacy proxyTarget", () => {
    const check = evaluateIngressRoute(context({
      domains: ["legacy.example.com"],
      proxyTarget: "legacy:9999",
      entries: [entry("app.example.com", "web", 3000)],
    }), NOW);
    expect(check.status).toBe("checked");
    expect(check.reasonCode).toBe("route_and_site_bound");
  });

  it("keeps legacy snapshots executable for historical revisions", () => {
    const check = evaluateIngressRoute(context({
      domains: ["app.example.com"], proxyTarget: "web:3000",
    }), NOW);
    expect(check.status).toBe("checked");
  });

  it("does not pass D16 when entries lack a verified service target", () => {
    const check = evaluateIngressRoute(context({
      entries: [{ ...entry("app.example.com", "web", 3000), serviceId: null }],
    }), NOW);
    expect(check.status).toBe("unavailable");
    expect(check.reasonCode).toBe("route_binding_missing");
  });

  it("blocks entries that exceed the single-upstream provider capacity", () => {
    const check = evaluateIngressRoute(context({
      entries: [
        entry("app.example.com", "web", 3000),
        entry("api.example.com", "api", 8080),
      ],
    }), NOW);
    expect(check.status).toBe("blocked");
    expect(check.reasonCode).toBe("multiple_route_upstreams");
  });
});

function entry(domain: string, component: string, port: number) {
  return {
    domain, path: "/", serviceId: `service-${component}`, component, port,
    tlsMode: "managed_cert",
  };
}

function context(routeSnapshot: Record<string, unknown>) {
  return {
    promote: {
      environment: {
        id: "prod-env",
        currentConfigRevision: {
          id: "rev-1", routeSnapshot, createdAt: NOW,
        },
      },
      sites: [{
        id: "site-1", environmentId: "prod-env", status: "active",
        primaryDomain: "app.example.com", lastSyncAt: NOW, updatedAt: NOW,
      }],
      releaseRun: null,
    },
  } as unknown as ReleaseGateEvidenceContext;
}
