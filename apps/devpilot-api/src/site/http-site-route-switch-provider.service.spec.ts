import { ConfigService } from "@nestjs/config";
import { ConfiguredSiteRouteSwitchProvider } from "./configured-site-route-switch-provider.service";
import { HttpSiteRouteSwitchProvider } from "./http-site-route-switch-provider.service";
import { validateSiteRouteSwitchReceipt } from "./site-route-switch-receipt.policy";
import { UnconfiguredSiteRouteSwitchProvider } from "./site-route-switch.port";
import type { SiteRouteSwitchInput } from "./site-route-switch.types";

describe("HTTP site route switch provider", () => {
  afterEach(() => jest.restoreAllMocks());

  it("applies a route and accepts only the independent exact readback", async () => {
    const input = routeInput();
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(capabilityResponse())
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        Response.json({
          observedAt: "2026-08-09T00:00:00.000Z",
          observed: {
            siteId: input.siteId,
            deploymentRunId: input.deploymentRunId,
            targetRef: input.targetRef,
            routeHash: input.routeHash,
          },
        }),
      );
    const provider = new HttpSiteRouteSwitchProvider(
      config("http-route-control-v1"),
    );

    const receipt = await provider.switchRoute(input);

    expect(
      validateSiteRouteSwitchReceipt(input, receipt, provider.identity),
    ).toEqual({
      accepted: true,
      reasonCode: "site_route_switched",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `http://route-control:8080/v1/routes/${encodeURIComponent(input.operationId)}`,
      expect.objectContaining({ method: "PUT" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `http://route-control:8080/v1/routes/${encodeURIComponent(input.operationId)}`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("keeps a mismatched readback fail-closed under the central receipt policy", async () => {
    const input = routeInput();
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(capabilityResponse())
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        Response.json({
          observedAt: "2026-08-09T00:00:00.000Z",
          observed: {
            siteId: input.siteId,
            deploymentRunId: "other-run",
            targetRef: input.targetRef,
            routeHash: input.routeHash,
          },
        }),
      );
    const provider = new HttpSiteRouteSwitchProvider(
      config("http-route-control-v1"),
    );

    const receipt = await provider.switchRoute(input);

    expect(
      validateSiteRouteSwitchReceipt(input, receipt, provider.identity),
    ).toEqual({
      accepted: false,
      reasonCode: "route_switch_deployment_mismatch",
    });
  });

  it("clears a first Production route only with expected-current CAS", async () => {
    const input = routeInput();
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(capabilityResponse())
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        Response.json({
          observedAt: "2026-08-10T00:00:00.000Z",
          observed: null,
        }),
      );
    const provider = new HttpSiteRouteSwitchProvider(
      config("http-route-control-v1"),
    );

    const receipt = await provider.compensateRoute({
      version: 1,
      operationId: "compensation-1",
      originalOperationId: input.operationId,
      expectedCurrent: {
        siteId: input.siteId,
        deploymentRunId: input.deploymentRunId,
        targetRef: input.targetRef,
        routeHash: input.routeHash,
      },
      desiredRoute: null,
    });

    expect(receipt).toMatchObject({ status: "switched", observed: null });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://route-control:8080/v1/routes/compensation-1",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"action":"clear"'),
      }),
    );
  });

  it("does not advertise compensation before an exact protocol handshake", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      Response.json({
        protocol: "site-route-control",
        version: 2,
        capabilities: {},
      }),
    );
    const provider = new HttpSiteRouteSwitchProvider(
      config("http-route-control-v1"),
    );

    expect(provider.supportsCompensation).toBe(false);
    await expect(provider.verifyProductionCapability()).rejects.toThrow(
      "route_switch_capability_mismatch",
    );
    expect(provider.supportsCompensation).toBe(false);
  });

  it("fails closed on an expected-current CAS conflict", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(capabilityResponse())
      .mockResolvedValueOnce(new Response(null, { status: 409 }));
    const provider = new HttpSiteRouteSwitchProvider(
      config("http-route-control-v1"),
    );

    await expect(provider.switchRoute(routeInput())).resolves.toMatchObject({
      status: "failed",
      reasonCode: "route_switch_cas_conflict",
    });
  });

  it("observes the external current route before preparing an apply CAS", async () => {
    const current = routeInput();
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(capabilityResponse())
      .mockResolvedValueOnce(
        Response.json({
          observedAt: "2026-08-10T00:00:00.000Z",
          observed: {
            siteId: current.siteId,
            deploymentRunId: current.deploymentRunId,
            targetRef: current.targetRef,
            routeHash: current.routeHash,
          },
          route: current,
        }),
      );
    const provider = new HttpSiteRouteSwitchProvider(
      config("http-route-control-v1"),
    );

    await expect(
      provider.observeCurrentRoute({
        teamId: current.teamId,
        projectId: current.projectId,
        environmentId: current.environmentId,
        siteId: current.siteId,
      }),
    ).resolves.toMatchObject({ status: "observed", route: current });
    expect(fetchMock.mock.calls[1][0]).toContain("/v1/routes/current?");
  });

  it("preserves the unconfigured default and rejects an incomplete enabled profile", () => {
    const unconfigured = new UnconfiguredSiteRouteSwitchProvider();
    const disabledHttp = new HttpSiteRouteSwitchProvider(config("disabled"));
    expect(
      new ConfiguredSiteRouteSwitchProvider(
        config("disabled"),
        disabledHttp,
        unconfigured,
      ).identity.providerKey,
    ).toBe("unconfigured");

    expect(
      () =>
        new ConfiguredSiteRouteSwitchProvider(
          config("http-route-control-v1", false),
          new HttpSiteRouteSwitchProvider(
            config("http-route-control-v1", false),
          ),
          unconfigured,
        ),
    ).toThrow("SITE_ROUTE_SWITCH_HTTP_CONFIGURATION_INVALID");
  });
});

function config(profile: string, complete = true) {
  const values: Record<string, unknown> = {
    SITE_ROUTE_SWITCH_PROVIDER_PROFILE: profile,
    SITE_ROUTE_SWITCH_HTTP_TIMEOUT_MS: 5000,
    ...(complete
      ? {
          SITE_ROUTE_SWITCH_HTTP_ENDPOINT: "http://route-control:8080/",
          SITE_ROUTE_SWITCH_HTTP_TOKEN:
            "route-control-test-token-0000000000000000",
        }
      : {}),
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function routeInput(): SiteRouteSwitchInput {
  return {
    version: 1,
    operationId: `site-route:deployment:${"a".repeat(64)}`,
    teamId: "team",
    projectId: "project",
    environmentId: "environment",
    siteId: "site",
    deploymentRunId: "deployment",
    releaseRunId: "release",
    primaryDomain: "parity.example.test",
    domains: ["parity.example.test"],
    entries: [],
    proxyTarget: "http://target-workload",
    targetRef: "filesystem-release-target",
    routeHash: "a".repeat(64),
    expectedCurrent: null,
  };
}

function capabilityResponse() {
  return Response.json({
    protocol: "site-route-control",
    version: 1,
    capabilities: {
      observeCurrent: true,
      expectedCurrentCas: true,
      compensation: true,
      clear: true,
    },
  });
}
