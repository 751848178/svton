import { runEnvironmentDeployment } from "./environment-version-deployment";

describe("Environment version deployment boundary", () => {
  it("completes Staging without Production route or site gates", async () => {
    const completion = { complete: jest.fn((input) => Promise.resolve(input)) };
    const deps = {
      completion,
      executor: {
        deploy: jest.fn().mockResolvedValue({
          logs: ["provider deployed exact manifest"],
          deploymentUri: "release-target://project-1/staging/run-1",
          evidence: { artifactVerified: true },
        }),
      },
      gateEvidence: { record: jest.fn().mockResolvedValue(undefined) },
      productionGates: {
        finalize: jest.fn(),
        denied: jest.fn(),
      },
      routeActivation: { resolve: jest.fn() },
      routeSwitch: { switchRoute: jest.fn() },
      siteProbe: { probe: jest.fn() },
    };

    const result = await runEnvironmentDeployment(
      deps as never,
      context() as never,
    );

    expect(result).toMatchObject({
      status: "completed",
      deploymentRunId: "run-1",
      result: {
        artifactVerified: true,
        manifestId: "manifest-1",
        manifestDigest: "sha256:exact",
        sourceVersionId: "version-0",
      },
    });
    expect(deps.gateEvidence.record).toHaveBeenCalledWith(
      expect.objectContaining({ deploymentRunId: "run-1" }),
    );
    expect(deps.routeActivation.resolve).not.toHaveBeenCalled();
    expect(deps.routeSwitch.switchRoute).not.toHaveBeenCalled();
    expect(deps.siteProbe.probe).not.toHaveBeenCalled();
    expect(deps.productionGates.finalize).not.toHaveBeenCalled();
  });
});

function context() {
  return {
    input: {
      teamId: "team-1",
      actorId: "actor-1",
      projectId: "project-1",
      environmentId: "staging",
      kind: "recovery",
    },
    environment: { id: "staging", baselineRole: "staging" },
    manifest: {
      id: "manifest-1",
      digest: "sha256:exact",
      releaseOrderId: "order-1",
      buildRun: { id: "build-1" },
    },
    bundle: { uri: "release-artifact://build-1/bundle.zip" },
    selection: { sourceVersionId: "version-0" },
    frozenInput: {
      deploymentInput: {
        snapshot: { target: { targetRef: "bound-target" } },
        runtimeEnvironment: { NODE_ENV: "staging" },
        targetConnection: undefined,
      },
      workload: { services: [] },
    },
    run: { id: "run-1" },
  };
}
