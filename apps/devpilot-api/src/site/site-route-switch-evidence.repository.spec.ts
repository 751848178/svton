import { SiteRouteSwitchEvidenceRepository } from "./site-route-switch-evidence.repository";
import type { SiteRouteSwitchEvidence } from "./site-route-switch.types";

describe("SiteRouteSwitchEvidenceRepository", () => {
  it("records an unavailable attempt without writing a switched Site pointer", async () => {
    const tx = transaction();
    await new SiteRouteSwitchEvidenceRepository().persist(tx as never, {
      evidence: evidence("unavailable"),
    });

    expect(tx.site.updateMany).not.toHaveBeenCalled();
    expect(tx.siteRouteSwitchRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deploymentRunId: "deployment-1",
          status: "failed",
          reasonCode: "route_switch_provider_unconfigured",
        }),
      }),
    );
  });

  it("writes the Site pointer only for validated switched evidence", async () => {
    const tx = transaction();
    await new SiteRouteSwitchEvidenceRepository().persist(tx as never, {
      evidence: evidence("switched"),
    });

    expect(tx.site.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          routeSwitch: expect.objectContaining({
            deploymentRunId: "deployment-1",
            routeHash: "route-hash-1",
            switchedAt: "2026-08-08T06:00:00.000Z",
          }),
        }),
      }),
    );
  });
});

function transaction() {
  return {
    site: {
      findUnique: jest.fn().mockResolvedValue({ tls: {} }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    siteRouteSwitchRun: {
      create: jest.fn().mockResolvedValue({ id: "attempt-1" }),
    },
  };
}

function evidence(
  status: SiteRouteSwitchEvidence["status"],
): SiteRouteSwitchEvidence {
  const switched = status === "switched";
  return {
    version: 1,
    operationId: "site-route:deployment-1:route-hash-1",
    teamId: "team-1",
    projectId: "project-1",
    environmentId: "environment-1",
    siteId: "site-1",
    deploymentRunId: "deployment-1",
    releaseRunId: "release-1",
    primaryDomain: "app.example.com",
    domains: ["app.example.com"],
    entries: [],
    proxyTarget: "http://target.internal:8080",
    targetRef: "server-1/service-1",
    routeHash: "route-hash-1",
    expectedCurrent: null,
    providerKey: switched ? "test-provider" : "unconfigured",
    status,
    reasonCode: switched
      ? "site_route_switched"
      : "route_switch_provider_unconfigured",
    switchedAt: switched ? "2026-08-08T06:00:00.000Z" : null,
    receipt: {
      version: 1,
      providerKey: switched ? "test-provider" : "unconfigured",
      operationId: "site-route:deployment-1:route-hash-1",
      status,
      reasonCode: switched
        ? "provider_switched"
        : "route_switch_provider_unconfigured",
      observedAt: switched ? "2026-08-08T06:00:00.000Z" : null,
      observed: switched
        ? {
            siteId: "site-1",
            deploymentRunId: "deployment-1",
            targetRef: "server-1/service-1",
            routeHash: "route-hash-1",
          }
        : null,
    },
  };
}
