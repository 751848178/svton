import { presentBuild } from "./release-build.presenter";

describe("presentBuild", () => {
  it.each([2, 3])("presents immutable v%s snapshot provenance", (version) => {
    const presented = presentBuild(
      record({
        inputSnapshot: {
          version,
          repositoryIdentity: {
            id: "identity-1",
            revisionId: "revision-2",
            revision: 2,
            provider: "github",
            canonicalUrl: "https://github.com/example/original",
          },
          sourceBranch: "release",
          sourceCommitSha: "a".repeat(40),
          components: [],
        },
        repositoryIdentity: {
          provider: "gitlab",
          canonicalUrl: "https://gitlab.com/example/mutated",
        },
        repositoryIdentityRevision: {
          id: "revision-99",
          revision: 99,
          defaultBranch: "mutated",
        },
      }),
    );
    expect(presented).toMatchObject({
      sourceBranch: "release",
      sourceCommitSha: "a".repeat(40),
      sourceRepository: {
        provider: "github",
        canonicalUrl: "https://github.com/example/original",
        identityRevisionId: "revision-2",
        identityRevision: 2,
        branch: "release",
      },
    });
  });

  it.each([{ version: 1 }, null])(
    "falls back to legacy joined provenance for %p",
    (inputSnapshot) => {
      expect(presentBuild(record({ inputSnapshot })).sourceRepository).toEqual({
        provider: "generic",
        canonicalUrl: "https://example.com/repo",
        identityRevisionId: "revision-1",
        identityRevision: 1,
        branch: "main",
      });
    },
  );

  it.each([
    {
      label: "malformed v2",
      inputSnapshot: { version: 2, repositoryIdentity: null },
    },
    { label: "future version", inputSnapshot: { version: 4 } },
    { label: "missing version", inputSnapshot: {} },
    { label: "string version", inputSnapshot: { version: "1" } },
    { label: "array", inputSnapshot: [] },
    { label: "undefined", inputSnapshot: undefined },
  ])(
    "fails closed for $label instead of borrowing mutable joins",
    ({ inputSnapshot }) => {
      expect(
        presentBuild(record({ inputSnapshot })).sourceRepository,
      ).toBeNull();
    },
  );

  it("fails closed for unredacted logs and re-sanitizes accepted lines", () => {
    const rejected = presentBuild(
      record({ logSummary: { redacted: false, lines: ["password=sentinel"] } }),
    );
    expect(rejected.logSummary).toBeNull();

    const accepted = presentBuild(
      record({
        logSummary: {
          redacted: true,
          lines: ["token=ghp_12345678901234567890", "build complete"],
        },
      }),
    );
    expect(accepted.logSummary).toMatchObject({
      redacted: true,
      lines: ["token=[REDACTED]", "build complete"],
    });
  });

  it("redacts legacy error messages while retaining their stable code", () => {
    const presented = presentBuild(
      record({
        errorCode: "BUILD_COMMAND_FAILED",
        errorMessage: "password=sentinel-error-secret",
      }),
    );
    expect(presented.errorCode).toBe("BUILD_COMMAND_FAILED");
    expect(presented.errorMessage).toBe("password=[REDACTED]");
  });
});

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    releaseOrderId: "order-1",
    revision: 1,
    sourceBranch: "main",
    sourceCommitSha: "b".repeat(40),
    status: "succeeded",
    inputSnapshot: null,
    inputHash: "hash",
    logReference: null,
    logSummary: null,
    gateSummary: null,
    errorCode: null,
    errorMessage: null,
    startedAt: new Date(),
    finishedAt: new Date(),
    createdAt: new Date(),
    manifest: null,
    repositoryIdentity: {
      provider: "generic",
      canonicalUrl: "https://example.com/repo",
    },
    repositoryIdentityRevision: {
      id: "revision-1",
      revision: 1,
      defaultBranch: "main",
    },
    ...overrides,
  };
}
