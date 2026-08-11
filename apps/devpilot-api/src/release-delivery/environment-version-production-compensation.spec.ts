import { siteRouteSwitchEvidence } from "../site/site-route-switch-receipt.policy";
import { siteRouteSwitchTestDouble } from "../site/site-route-switch.spec-utils";
import { finalizeDeployedEnvironment } from "./environment-version-production-finalization";

describe("Production route finalization compensation", () => {
  it.each(["gate", "completion"] as const)(
    "compensates an applied route after %s failure without advancing a version",
    async (failureAt) => {
      const provider = siteRouteSwitchTestDouble();
      const routeSaga = {
        assertProductionReady: jest.fn(),
        apply: jest.fn(async (input) => {
          const receipt = await provider.switchRoute(input);
          return {
            evidence: siteRouteSwitchEvidence(
              input,
              receipt,
              provider.identity,
            ),
          };
        }),
        compensate: jest.fn().mockResolvedValue("compensated"),
      };
      const completion = {
        complete: jest.fn(async (input) => {
          if (failureAt === "completion" && input.status === "completed") {
            throw new Error("completion transaction failed");
          }
          return input;
        }),
      };
      const productionGates = {
        finalize:
          failureAt === "gate"
            ? jest.fn().mockRejectedValue(new Error("final gate failed"))
            : jest.fn().mockResolvedValue(decision("final")),
        denied: jest.fn().mockResolvedValue(decision("denied")),
      };

      const result = await finalizeDeployedEnvironment(
        {
          completion,
          productionGates,
          routeActivation: {
            resolve: jest.fn().mockResolvedValue(activation()),
          },
          routeSaga,
          siteProbe: { probe: jest.fn().mockResolvedValue(healthyProbe()) },
        } as never,
        context() as never,
        ["deployed"],
        { deployment: "ok" },
      );

      expect(routeSaga.compensate).toHaveBeenCalledWith(
        expect.stringContaining("site-route:deployment-1:"),
        expect.anything(),
      );
      expect(result).toMatchObject({ status: "failed" });
      expect(completion.complete).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "failed" }),
      );
    },
  );

  it("blocks the DeploymentRun when compensation cannot be verified", async () => {
    const provider = siteRouteSwitchTestDouble();
    const completion = { complete: jest.fn(async (input) => input) };
    const routeSaga = {
      assertProductionReady: jest.fn(),
      apply: jest.fn(async (input) => ({
        evidence: siteRouteSwitchEvidence(
          input,
          await provider.switchRoute(input),
          provider.identity,
        ),
      })),
      compensate: jest.fn().mockResolvedValue("compensation_required"),
    };

    const result = await finalizeDeployedEnvironment(
      {
        completion,
        productionGates: {
          finalize: jest.fn().mockRejectedValue(new Error("gate failed")),
          denied: jest.fn().mockResolvedValue(decision("denied")),
        },
        routeActivation: { resolve: jest.fn().mockResolvedValue(activation()) },
        routeSaga,
        siteProbe: { probe: jest.fn().mockResolvedValue(healthyProbe()) },
      } as never,
      context() as never,
      ["deployed"],
      { deployment: "ok" },
    );

    expect(result).toMatchObject({ status: "blocked" });
    expect(completion.complete).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "blocked" }),
    );
  });
});

function activation() {
  return {
    siteId: "site-1",
    primaryDomain: "app.example.com",
    domains: ["app.example.com"],
    entries: [],
    proxyTarget: "http://target.internal:8080",
    status: "matched",
    reasonCode: "site_route_matched",
  };
}

function healthyProbe() {
  const checkedAt = "2026-08-10T00:00:00.000Z";
  const finalUrl = "https://app.example.com/";
  return {
    version: 1,
    primaryDomain: "app.example.com",
    finalUrl,
    probedAt: checkedAt,
    dns: { status: "resolved", checkedAt },
    tls: { status: "valid", checkedAt },
    http: {
      status: "passed",
      statusCode: 200,
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
    productionRun: { routeSnapshot: { tlsRequired: true } },
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
  return { id: `decision-${stage}`, stage, inputHash: `hash-${stage}` };
}
