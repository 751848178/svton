import { UnconfiguredSiteRouteSwitchProvider } from "../site/site-route-switch.port";
import { siteRouteSwitchTestDouble } from "../site/site-route-switch.spec-utils";
import { finalizeDeployedEnvironment } from "./environment-version-production-finalization";

describe("Production environment route finalization", () => {
  it("fails closed and records an unavailable attempt when no provider is configured", async () => {
    const completion = { complete: jest.fn((input) => Promise.resolve(input)) };
    const siteProbe = { probe: jest.fn() };
    const deps = {
      completion,
      productionGates: {
        finalize: jest.fn(),
        denied: jest.fn().mockResolvedValue(decision("denied")),
      },
      routeActivation: {
        resolve: jest.fn().mockResolvedValue({
          siteId: "site-1",
          primaryDomain: "app.example.com",
          domains: ["app.example.com"],
          proxyTarget: "http://target.internal:8080",
          status: "matched",
          reasonCode: "site_route_matched",
        }),
      },
      routeSwitch: new UnconfiguredSiteRouteSwitchProvider(),
      siteProbe,
    };
    const result = await finalizeDeployedEnvironment(
      deps as never,
      context() as never,
      ["deployed"],
      { deployment: "ok" },
    );

    expect(siteProbe.probe).not.toHaveBeenCalled();
    expect(completion.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        routeSwitchAttempt: {
          evidence: expect.objectContaining({
            siteId: "site-1",
            deploymentRunId: "deployment-1",
            status: "unavailable",
            reasonCode: "route_switch_provider_unconfigured",
            switchedAt: null,
          }),
        },
      }),
    );
    expect(result).toMatchObject({ status: "failed" });
  });

  it.each([
    ["missing route snapshot", "route_not_frozen"],
    ["empty route domains", "no_route_domains"],
  ])(
    "never submits a completed pointer transition for %s",
    async (_label, reasonCode) => {
      const completion = {
        complete: jest.fn((input) => Promise.resolve(input)),
      };
      const productionGates = {
        finalize: jest.fn(),
        denied: jest.fn().mockResolvedValue(decision("denied")),
      };
      const result = await finalizeDeployedEnvironment(
        {
          completion,
          productionGates,
          routeActivation: {
            resolve: jest.fn().mockResolvedValue({
              siteId: null,
              primaryDomain: null,
              domains: [],
              proxyTarget: null,
              status: "unavailable",
              reasonCode,
            }),
          },
          routeSwitch: siteRouteSwitchTestDouble(),
          siteProbe: { probe: jest.fn().mockResolvedValue(probe(null)) },
        } as never,
        context() as never,
        ["deployed"],
        { deployment: "ok" },
      );

      expect(result).toMatchObject({ status: "failed" });
      expect(completion.complete).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed" }),
      );
      expect(completion.complete).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed" }),
      );
      expect(productionGates.finalize).not.toHaveBeenCalled();
    },
  );

  it("does not advance completion when exact final URL HTTP proof is unavailable", async () => {
    const completion = { complete: jest.fn((input) => Promise.resolve(input)) };
    const productionGates = {
      finalize: jest.fn(),
      denied: jest.fn().mockResolvedValue(decision("denied")),
    };
    const result = await finalizeDeployedEnvironment(
      {
        completion,
        productionGates,
        routeActivation: { resolve: jest.fn().mockResolvedValue(activation()) },
        routeSwitch: siteRouteSwitchTestDouble(),
        siteProbe: { probe: jest.fn().mockResolvedValue(probe("unavailable")) },
      } as never,
      context() as never,
      ["deployed"],
      { deployment: "ok" },
    );

    expect(result).toMatchObject({ status: "failed" });
    expect(completion.complete).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
    expect(productionGates.finalize).not.toHaveBeenCalled();
  });

  it("attributes a provider exception to the configured identity", async () => {
    const completion = { complete: jest.fn((input) => Promise.resolve(input)) };
    const provider = {
      identity: { providerKey: "failing-test-provider", receiptVersion: 1 },
      switchRoute: jest.fn().mockRejectedValue(new Error("provider failed")),
    };
    await finalizeDeployedEnvironment(
      {
        completion,
        productionGates: {
          finalize: jest.fn(),
          denied: jest.fn().mockResolvedValue(decision("denied")),
        },
        routeActivation: { resolve: jest.fn().mockResolvedValue(activation()) },
        routeSwitch: provider,
        siteProbe: { probe: jest.fn() },
      } as never,
      context() as never,
      ["deployed"],
      { deployment: "ok" },
    );

    expect(completion.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        routeSwitchAttempt: {
          evidence: expect.objectContaining({
            providerKey: provider.identity.providerKey,
            status: "failed",
            receipt: expect.objectContaining({
              version: provider.identity.receiptVersion,
              providerKey: provider.identity.providerKey,
            }),
          }),
        },
      }),
    );
  });
});

function activation() {
  return {
    siteId: "site-1",
    primaryDomain: "app.example.com",
    domains: ["app.example.com"],
    proxyTarget: "http://unrelated.internal:8080",
    status: "matched",
    reasonCode: "site_route_matched",
  };
}

function probe(httpStatus: "unavailable" | null) {
  const checkedAt = "2026-08-08T00:00:00.000Z";
  const finalUrl = httpStatus === null ? null : "https://app.example.com/";
  return {
    version: 1,
    primaryDomain: finalUrl ? "app.example.com" : null,
    finalUrl,
    probedAt: checkedAt,
    dns: { status: finalUrl ? "resolved" : "unavailable", checkedAt },
    tls: { status: finalUrl ? "valid" : "unavailable", checkedAt },
    http: {
      status: httpStatus ?? "unavailable",
      url: finalUrl,
      finalUrl,
      checkedAt,
    },
  };
}

function context() {
  return {
    input: {
      teamId: "team-1",
      actorId: "actor-1",
      projectId: "project-1",
      environmentId: "environment-1",
      kind: "upgrade",
    },
    environment: { id: "environment-1", baselineRole: "production" },
    manifest: {
      id: "manifest-1",
      digest: "sha256:manifest",
      releaseOrderId: "order-1",
      buildRun: { id: "build-1" },
    },
    productionRun: {
      routeSnapshot: {
        domains: ["app.example.com"],
        proxyTarget: "http://target.internal:8080",
        tlsRequired: true,
      },
    },
    releaseRunId: "release-1",
    gateContext: {},
    run: { id: "deployment-1" },
    frozenInput: {
      deploymentInput: {
        snapshot: { target: { targetRef: "server-1/service-1" } },
      },
    },
  };
}

function decision(stage: string) {
  return {
    id: `decision-${stage}`,
    stage,
    inputHash: `hash-${stage}`,
    decision: "denied",
  };
}
