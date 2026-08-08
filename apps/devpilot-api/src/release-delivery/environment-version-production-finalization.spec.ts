import { UnconfiguredSiteRouteSwitchProvider } from "../site/site-route-switch.port";
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
});

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
      deploymentInput: { snapshot: { target: { targetRef: "server-1/service-1" } } },
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
