import { SiteRouteActivationService } from "../site/site-route-activation.service";
import { SiteRouteActivationError } from "../site/site-probe-policy";
import { applySiteRouteSwitch } from "../site/site-route-activation.service";

describe("SiteRouteActivationService", () => {
  it("returns unavailable when the frozen route has no domains", async () => {
    const service = new SiteRouteActivationService(undefined as never);
    const result = await service.resolve({
      teamId: "team-1",
      projectId: "project-1",
      environmentId: "env-1",
      routeSnapshot: {},
    });
    expect(result).toMatchObject({
      status: "unavailable",
      reasonCode: "no_route_domains",
      siteId: null,
    });
  });

  it("fails closed when the frozen route declares domains but no matching Site exists", async () => {
    const prisma = {
      site: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new SiteRouteActivationService(prisma as never);
    const error = await service
      .resolve({
        teamId: "team-1",
        projectId: "project-1",
        environmentId: "env-1",
        routeSnapshot: {
          domains: ["demo.f437.example"],
          proxyTarget: "http://127.0.0.1:8080",
        },
      })
      .catch((item: unknown) => item);
    expect(error).toBeInstanceOf(SiteRouteActivationError);
    expect((error as SiteRouteActivationError).detail).toMatchObject({
      code: "SITE_ROUTE_ACTIVATION_FAILED",
      evidence: {
        routeSwitch: { status: "unavailable", reasonCode: "site_not_found" },
      },
    });
    expect(prisma.site.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          teamId: "team-1",
          projectId: "project-1",
          environmentId: "env-1",
          primaryDomain: { in: ["demo.f437.example"] },
        },
      }),
    );
  });

  it("matches a Site that belongs to the project and environment", async () => {
    const prisma = {
      site: {
        findFirst: jest.fn().mockResolvedValue({
          id: "site-1",
          primaryDomain: "demo.f437.example",
          status: "active",
        }),
      },
    };
    const service = new SiteRouteActivationService(prisma as never);
    const result = await service.resolve({
      teamId: "team-1",
      projectId: "project-1",
      environmentId: "env-1",
      routeSnapshot: {
        domains: ["demo.f437.example"],
        proxyTarget: "http://127.0.0.1:8080",
      },
    });
    expect(result).toMatchObject({
      siteId: "site-1",
      status: "matched",
      reasonCode: "site_route_matched",
    });
  });
});

describe("applySiteRouteSwitch", () => {
  it("throws SITE_ROUTE_SWITCH_CONFLICT when the Site is not bound to the project/environment", async () => {
    const tx = {
      site: {
        findUnique: jest.fn().mockResolvedValue({ tls: { status: "valid" } }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      siteRouteSwitchRun: {
        create: jest.fn(),
      },
    };
    await expect(
      applySiteRouteSwitch(tx as never, {
        teamId: "team-1",
        projectId: "project-1",
        environmentId: "env-1",
        siteId: "site-1",
        deploymentRunId: "run-1",
        domains: ["demo.f437.example"],
      }),
    ).rejects.toThrow("SITE_ROUTE_SWITCH_CONFLICT");
    expect(tx.siteRouteSwitchRun.create).not.toHaveBeenCalled();
  });

  it("persists an append-only SiteRouteSwitchRun and updates the Site row", async () => {
    const tx = {
      site: {
        findUnique: jest.fn().mockResolvedValue({ tls: { status: "valid" } }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      siteRouteSwitchRun: {
        create: jest.fn().mockResolvedValue({ id: "switch-1" }),
      },
    };
    await applySiteRouteSwitch(tx as never, {
      teamId: "team-1",
      projectId: "project-1",
      environmentId: "env-1",
      siteId: "site-1",
      deploymentRunId: "run-1",
      releaseRunId: "release-1",
      targetRef: "target-ref-1",
      proxyTarget: "http://127.0.0.1:8080",
      domains: ["demo.f437.example"],
      dnsProbe: {
        status: "resolved",
        hostname: "demo.f437.example",
        records: ["198.18.11.9"],
        checkedAt: "2026-08-06T12:00:00.000Z",
      },
      tlsProbe: {
        status: "unavailable",
        host: "demo.f437.example",
        port: 443,
        servername: "demo.f437.example",
        error: { code: "ENOTFOUND", message: "unreachable" },
        checkedAt: "2026-08-06T12:00:00.000Z",
      },
    });
    expect(tx.site.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dns: expect.objectContaining({
            status: "resolved",
            hostname: "demo.f437.example",
          }),
          routeSwitch: expect.objectContaining({
            deploymentRunId: "run-1",
            status: "switched",
            reasonCode: "site_switched",
          }),
        }),
      }),
    );
    expect(tx.siteRouteSwitchRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          siteId: "site-1",
          deploymentRunId: "run-1",
          releaseRunId: "release-1",
          status: "switched",
          targetRef: "target-ref-1",
        }),
      }),
    );
  });
});
