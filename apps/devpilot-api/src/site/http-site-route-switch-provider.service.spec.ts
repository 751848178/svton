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
      1,
      `http://route-control:8080/v1/routes/${encodeURIComponent(input.operationId)}`,
      expect.objectContaining({ method: "PUT" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `http://route-control:8080/v1/routes/${encodeURIComponent(input.operationId)}`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("keeps a mismatched readback fail-closed under the central receipt policy", async () => {
    const input = routeInput();
    jest
      .spyOn(global, "fetch")
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
    proxyTarget: "http://target-workload",
    targetRef: "filesystem-release-target",
    routeHash: "a".repeat(64),
  };
}
