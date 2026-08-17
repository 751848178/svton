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
  sourceEvidence: {
    status: "passed",
    reasonCode: "source_state_verified",
    checkedAt: "2026-08-11T00:00:00.000Z",
    evidenceRef: "release-evidence://source/report.json",
    evidenceHash: "source-hash",
  },
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
      target: {
        sourceBranch: "main",
        sourceCommitSha: "a".repeat(40),
        sourceEvidence: source.sourceEvidence,
      },
      actionInput: {
        repositoryIdentityRevisionId: "revision-1",
        sourceBranch: "main",
        sourceCommitSha: "a".repeat(40),
      },
    });
    expect(gates.assertAllowed).toHaveBeenCalledWith({
      ...scope,
      checkpoint: "build_pre_execution",
      ...preview,
    });
    expect(admitted).toEqual({ source, decision });
  });

  it("does not defer unavailable Provider gates", async () => {
    const sources = { resolve: jest.fn().mockResolvedValue(source) };
    const blocked = new Error("provider gate unavailable");
    const gates = { assertAllowed: jest.fn().mockRejectedValue(blocked) };

    await expect(
      admitReleaseBuild(sources as never, gates as never, scope),
    ).rejects.toBe(blocked);
    expect(gates.assertAllowed.mock.calls[0][0]).not.toHaveProperty(
      "deferredReasons",
    );
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
      checkpoint: "build_pre_execution",
      target: { sourceResolution: "unavailable" },
      actionInput: { sourceResolution: "unavailable" },
    });
  });
});
