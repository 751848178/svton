import { RepositoryConnectionService } from "./repository-connection.service";

describe("RepositoryConnectionService identity preflight", () => {
  const connections = { assertProject: jest.fn() };
  const identityConnections = { saveVerified: jest.fn(), saveFailureIfUnlocked: jest.fn() };
  const identityReads = { state: jest.fn() };
  const credentials = { resolve: jest.fn(), listOptions: jest.fn() };
  const git = { allowsLocal: jest.fn().mockReturnValue(false), resolveRef: jest.fn() };
  const audit = { record: jest.fn() };
  const service = new RepositoryConnectionService(
    connections as never,
    identityConnections as never,
    identityReads as never,
    credentials as never,
    git as never,
    audit as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    connections.assertProject.mockResolvedValue({ id: "project-1" });
  });

  it("rejects a cross-repository URL before managed credentials or Git", async () => {
    identityReads.state.mockResolvedValue(lockedState());
    await expect(service.connect("team-1", "user-1", "project-1", {
      repositoryUrl: "https://github.com/example/other.git",
      branch: "main",
      visibility: "private",
      gitProvider: "github",
    })).rejects.toMatchObject({ response: { code: "PROJECT_REPOSITORY_IDENTITY_LOCKED" } });
    expect(credentials.resolve).not.toHaveBeenCalled();
    expect(git.resolveRef).not.toHaveBeenCalled();
    expect(identityConnections.saveVerified).not.toHaveBeenCalled();
  });

  it("rejects READY identity migration gaps before credentials or Git", async () => {
    identityReads.state.mockResolvedValue({
      onboardingStatus: "ready",
      repositoryIdentity: null,
    });
    await expect(service.connect("team-1", "user-1", "project-1", {
      repositoryUrl: "https://github.com/example/service.git",
      branch: "main",
      visibility: "public",
    })).rejects.toMatchObject({
      response: { code: "PROJECT_REPOSITORY_IDENTITY_MIGRATION_REQUIRED" },
    });
    expect(credentials.resolve).not.toHaveBeenCalled();
    expect(git.resolveRef).not.toHaveBeenCalled();
  });
});

function lockedState() {
  return {
    onboardingStatus: "ready",
    repositoryIdentity: {
      id: "identity-1",
      projectId: "project-1",
      provider: "github",
      canonicalKey: "github.com/example/service",
      canonicalUrl: "https://github.com/example/service",
      lockedAt: new Date(),
      currentRevision: {
        id: "revision-1",
        identityId: "identity-1",
        projectId: "project-1",
        revision: 1,
        defaultBranch: "main",
        reason: "initial",
        createdAt: new Date(),
      },
    },
  };
}
