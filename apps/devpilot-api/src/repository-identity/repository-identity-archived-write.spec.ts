import { RepositoryIdentityConnectionRepository } from "./repository-identity-connection.repository";

describe("RepositoryIdentityConnectionRepository archived boundary", () => {
  it.each(["verified", "failure"])(
    "rejects direct %s connection writes after taking the project lock",
    async (mode) => {
      const tx = {
        project: {
          findFirstOrThrow: jest.fn().mockResolvedValue({
            archivedAt: new Date(),
            onboardingStatus: "archived",
          }),
        },
        repositoryConnection: { upsert: jest.fn() },
      };
      const coordinator = {
        run: jest.fn(async (_teamId, _projectId, action) => action(tx)),
      };
      const repository = new RepositoryIdentityConnectionRepository(
        coordinator as never,
      );
      const common = {
        teamId: "team-1",
        projectId: "project-1",
        userId: "user-1",
        repositoryUrl: "https://git.example/repo.git",
        provider: "generic",
        visibility: "public",
        credentialSource: "none",
      };
      const action =
        mode === "verified"
          ? repository.saveVerified({
              ...common,
              defaultBranch: "main",
              selectedBranch: "main",
              commitSha: "a".repeat(40),
              branches: ["main"],
            })
          : repository.saveFailureIfUnlocked({
              ...common,
              errorCode: "FAILED",
              errorMessage: "failed",
            });

      await expect(action).rejects.toMatchObject({
        response: { code: "PROJECT_ARCHIVED_READ_ONLY" },
      });
      expect(tx.repositoryConnection.upsert).not.toHaveBeenCalled();
    },
  );
});
