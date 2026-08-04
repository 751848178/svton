import { RepositoryIdentityBranchService } from "./repository-identity-branch.service";

describe("RepositoryIdentityBranchService", () => {
  const reads = { state: jest.fn() };
  const revisions = { findReplay: jest.fn(), append: jest.fn() };
  const credentials = { resolveStored: jest.fn() };
  const git = { resolveRef: jest.fn() };
  const service = new RepositoryIdentityBranchService(
    reads as never,
    revisions as never,
    credentials as never,
    git as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("returns an exact stored replay without credentials or Git", async () => {
    revisions.findReplay.mockResolvedValue({
      identity: { id: "identity-1" },
      revision: {
        id: "revision-2",
        revision: 2,
        defaultBranch: "release",
        verifiedCommitSha: "a".repeat(40),
      },
      replayed: true,
    });
    await expect(service.revise("team-1", "user-1", "project-1", dto()))
      .resolves.toMatchObject({ commitSha: "a".repeat(40), replayed: true });
    expect(reads.state).not.toHaveBeenCalled();
    expect(credentials.resolveStored).not.toHaveBeenCalled();
    expect(git.resolveRef).not.toHaveBeenCalled();
  });

  it("rejects cross-identity current revision before credential resolution", async () => {
    revisions.findReplay.mockResolvedValue(null);
    reads.state.mockResolvedValue(state("identity-other"));
    await expect(service.revise("team-1", "user-1", "project-1", dto()))
      .rejects.toMatchObject({
        response: { code: "PROJECT_REPOSITORY_CONNECTION_DRIFT" },
      });
    expect(credentials.resolveStored).not.toHaveBeenCalled();
    expect(git.resolveRef).not.toHaveBeenCalled();
    expect(revisions.append).not.toHaveBeenCalled();
  });
});

function dto() {
  return {
    branch: "release",
    reason: "Promote release branch",
    expectedRevision: 1,
    idempotencyKey: "revision-key-1",
  };
}

function state(revisionIdentityId = "identity-1") {
  return {
    repositoryConnection: {
      id: "connection-1",
      repositoryUrl: "https://github.com/example/service.git",
      provider: "github",
      defaultBranch: "main",
      selectedBranch: "main",
      status: "connected",
    },
    repositoryIdentity: {
      id: "identity-1",
      projectId: "project-1",
      provider: "github",
      canonicalKey: "github.com/example/service",
      canonicalUrl: "https://github.com/example/service",
      lockedAt: new Date(),
      currentRevision: {
        id: "revision-1",
        identityId: revisionIdentityId,
        projectId: "project-1",
        revision: 1,
        defaultBranch: "main",
        reason: "initial",
        createdAt: new Date(),
      },
    },
  };
}
