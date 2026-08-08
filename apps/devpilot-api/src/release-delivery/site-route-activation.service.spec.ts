import { SiteRouteActivationService } from "../site/site-route-activation.service";
import { SiteRouteActivationError } from "../site/site-probe-policy";

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
