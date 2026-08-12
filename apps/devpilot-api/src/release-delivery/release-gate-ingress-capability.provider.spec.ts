import { ReleaseGateIngressCapabilityProvider } from "./release-gate-ingress-capability.provider";
import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";

const NOW = new Date("2026-08-06T12:00:00.000Z");

describe("ReleaseGateIngressCapabilityProvider D14/D15 honesty", () => {
  const provider = new ReleaseGateIngressCapabilityProvider();
  const d14 = RELEASE_GATE_DEFINITIONS.find((item) => item.id === "D14")!;
  const d15 = RELEASE_GATE_DEFINITIONS.find((item) => item.id === "D15")!;

  function context(overrides?: {
    dns?: unknown;
    tls?: unknown;
    status?: string;
    lastSyncAt?: Date;
    environmentId?: string;
  }) {
    const base = {
      promote: {
        environment: {
          id: "prod-env",
          currentConfigRevision: {
            id: "rev-1",
            routeSnapshot: {
              domains: ["demo.f437.example"],
              proxyTarget: "http://127.0.0.1:8080",
            },
            createdAt: new Date(),
          },
        },
        sites: [
          {
            id: "site-1",
            environmentId: "prod-env",
            status: "active",
            primaryDomain: "demo.f437.example",
            tls: { status: "valid", expiresAt: "2026-09-07T00:00:00.000Z" },
            dns: null,
            lastSyncAt: new Date("2026-08-06T11:59:00.000Z"),
            updatedAt: new Date("2026-08-06T11:59:00.000Z"),
          },
        ],
        releaseRun: {
          routeSnapshot: {
            domains: ["demo.f437.example"],
            proxyTarget: "http://127.0.0.1:8080",
          },
        },
      },
    };
    if (overrides?.dns !== undefined) {
      (base.promote.sites[0] as any).dns = overrides.dns;
    }
    if (overrides?.tls !== undefined) {
      (base.promote.sites[0] as any).tls = overrides.tls;
    }
    if (overrides?.status !== undefined) {
      (base.promote.sites[0] as any).status = overrides.status;
    }
    if (overrides?.environmentId !== undefined) {
      (base.promote.sites[0] as any).environmentId = overrides.environmentId;
    }
    if (overrides?.lastSyncAt !== undefined) {
      (base.promote.sites[0] as any).lastSyncAt = overrides.lastSyncAt;
    }
    return base as unknown as ReleaseGateEvidenceContext;
  }

  it("returns unavailable (not checked) when D14 has no fresh real DNS probe", () => {
    const check = provider.evaluate(d14, context({ dns: null }), NOW);
    expect(check.status).toBe("unavailable");
    expect(check.reasonCode).toBe("dns_probe_missing");
  });

  it("returns unavailable (not a pass) when D14 real DNS probe is unavailable", () => {
    const check = provider.evaluate(
      d14,
      context({
        dns: {
          status: "unavailable",
          hostname: "demo.f437.example",
          error: { code: "ENOTFOUND", message: "queryA ENOTFOUND" },
          checkedAt: new Date(NOW.getTime() - 60_000).toISOString(),
        },
      }),
      NOW,
    );
    expect(check.status).toBe("unavailable");
    expect(check.reasonCode).toBe("dns_probe_unavailable");
  });

  it("checks D14 when a fresh real DNS probe resolved", () => {
    const check = provider.evaluate(
      d14,
      context({
        dns: {
          status: "resolved",
          hostname: "demo.f437.example",
          records: ["127.0.0.1"],
          checkedAt: new Date(NOW.getTime() - 60_000).toISOString(),
        },
      }),
      NOW,
    );
    expect(check.status).toBe("checked");
    expect(check.reasonCode).toBe("dns_site_resolved");
  });

  it("returns unavailable when D14 real DNS probe is stale", () => {
    const check = provider.evaluate(
      d14,
      context({
        dns: {
          status: "resolved",
          hostname: "demo.f437.example",
          records: ["127.0.0.1"],
          checkedAt: new Date(NOW.getTime() - 3_600_000 - 1000).toISOString(),
        },
      }),
      NOW,
    );
    expect(check.status).toBe("unavailable");
    expect(check.reasonCode).toBe("dns_probe_missing");
  });

  it("blocks D15 on an expired certificate even when status says valid", () => {
    const check = provider.evaluate(
      d15,
      context({
        tls: {
          status: "valid",
          expiresAt: new Date(NOW.getTime() - 60_000).toISOString(),
        },
      }),
      NOW,
    );
    expect(check.status).toBe("blocked");
    expect(check.reasonCode).toBe("tls_certificate_expired");
  });

  it("blocks D15 when the real TLS probe reports an invalid/expired certificate", () => {
    const check = provider.evaluate(
      d15,
      context({
        tls: {
          status: "valid",
          expiresAt: "2026-09-07T00:00:00.000Z",
          probe: {
            status: "invalid",
            host: "demo.f437.example", servername: "demo.f437.example",
            cert: { expired: true },
            checkedAt: new Date(NOW.getTime() - 60_000).toISOString(),
          },
        },
      }),
      NOW,
    );
    expect(check.status).toBe("blocked");
    expect(check.reasonCode).toBe("tls_certificate_invalid");
  });

  it("binds a valid TLS probe to its exact site, environment and route", () => {
    const check = provider.evaluate(d15, context({ tls: {
      status: "valid", expiresAt: "2026-09-07T00:00:00.000Z",
      probe: { status: "valid", host: "demo.f437.example",
        servername: "demo.f437.example", checkedAt: NOW.toISOString() },
    } }), NOW);
    expect(check).toMatchObject({ status: "checked", evidenceIdentity: {
      siteId: "site-1", environmentId: "prod-env",
      hostname: "demo.f437.example",
    } });
    expect(check.evidenceIdentity?.routeHash).toEqual(expect.any(String));
  });

  it("blocks DNS and TLS when two active Sites own the frozen domain", () => {
    const duplicate = context({
      dns: {
        status: "resolved",
        checkedAt: NOW.toISOString(),
      },
    });
    duplicate.promote!.sites.push({
      ...duplicate.promote!.sites[0],
      id: "site-duplicate",
    });

    expect(provider.evaluate(d14, duplicate, NOW)).toMatchObject({
      status: "blocked",
      reasonCode: "multiple_route_sites",
    });
    expect(provider.evaluate(d15, duplicate, NOW)).toMatchObject({
      status: "blocked",
      reasonCode: "multiple_route_sites",
    });
  });

  it("returns unavailable (not a pass) when the real TLS probe could not be performed", () => {
    const check = provider.evaluate(
      d15,
      context({
        tls: {
          status: "valid",
          expiresAt: "2026-09-07T00:00:00.000Z",
          probe: {
            status: "unavailable",
            host: "demo.f437.example", servername: "demo.f437.example",
            error: { code: "ENOTFOUND", message: "unreachable" },
            checkedAt: new Date(NOW.getTime() - 60_000).toISOString(),
          },
        },
      }),
      NOW,
    );
    expect(check.status).toBe("unavailable");
    expect(check.reasonCode).toBe("tls_probe_unavailable");
  });

  it("does not accept client-configured TLS status without a server handshake probe", () => {
    const check = provider.evaluate(
      d15,
      context({
        tls: { status: "valid", expiresAt: "2026-09-07T00:00:00.000Z" },
      }),
      NOW,
    );
    expect(check.status).toBe("unavailable");
    expect(check.reasonCode).toBe("tls_certificate_unverified");
  });

  it("rejects old DNS and TLS probes after the frozen route domain changes", () => {
    const value = context({
      dns: { status: "resolved", hostname: "old.example",
        checkedAt: NOW.toISOString() },
      tls: { probe: { status: "valid", host: "old.example",
        servername: "old.example", checkedAt: NOW.toISOString() } },
    });
    expect(provider.evaluate(d14, value, NOW)).toMatchObject({
      status: "unavailable", reasonCode: "dns_probe_scope_mismatch",
    });
    expect(provider.evaluate(d15, value, NOW)).toMatchObject({
      status: "unavailable", reasonCode: "tls_probe_scope_mismatch",
    });
  });
});
