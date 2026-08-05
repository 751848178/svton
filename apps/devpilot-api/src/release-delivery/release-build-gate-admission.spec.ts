import {
  admitReleaseBuild,
  previewReleaseBuildGate,
} from "./release-build-gate-admission";

const scope = {
  teamId: "team-1",
  actorId: "user-1",
  projectId: "project-1",
  releaseOrderId: "order-1",
};

const source = {
  identity: {
    revisionId: "revision-1",
    branch: "main",
  },
  commitSha: "a".repeat(40),
};

describe("release build gate admission", () => {
  it("uses the same exact source input for catalog preview and execution", async () => {
    const sources = { resolve: jest.fn().mockResolvedValue(source) };
    const preview = await previewReleaseBuildGate(sources as never, scope);
    const decision = { id: "decision-1", stage: "build" };
    const gates = { assertAllowed: jest.fn().mockResolvedValue(decision) };
    const admitted = await admitReleaseBuild(
      sources as never,
      gates as never,
      scope,
    );

    expect(preview).toEqual({
      target: { sourceBranch: "main", sourceCommitSha: "a".repeat(40) },
      actionInput: {
        repositoryIdentityRevisionId: "revision-1",
        sourceBranch: "main",
        sourceCommitSha: "a".repeat(40),
      },
    });
    expect(gates.assertAllowed).toHaveBeenCalledWith({
      ...scope,
      stage: "build",
      ...preview,
    });
    expect(admitted).toEqual({ source, decision });
  });

  it("fails closed with the same unavailable source input", async () => {
    const sourceError = new Error("repository unavailable");
    const gateError = new Error("gate blocked");
    const sources = { resolve: jest.fn().mockRejectedValue(sourceError) };
    const gates = { assertAllowed: jest.fn().mockRejectedValue(gateError) };

    await expect(
      previewReleaseBuildGate(sources as never, scope),
    ).resolves.toEqual({
      target: { sourceResolution: "unavailable" },
      actionInput: { sourceResolution: "unavailable" },
    });
    await expect(
      admitReleaseBuild(sources as never, gates as never, scope),
    ).rejects.toBe(gateError);
    expect(gates.assertAllowed).toHaveBeenCalledWith({
      ...scope,
      stage: "build",
      target: { sourceResolution: "unavailable" },
      actionInput: { sourceResolution: "unavailable" },
    });
  });
});
