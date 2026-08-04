import { ForbiddenException } from "@nestjs/common";
import { RepositoryAnalysisController } from "./repository-analysis.controller";

describe("repository identity high-risk authorization", () => {
  it("denies branch revision before service, Git, mutation or audit", async () => {
    const access = {
      assertWrite: jest.fn().mockRejectedValue(new ForbiddenException("denied")),
    };
    const identityBranches = { revise: jest.fn() };
    const controller = new RepositoryAnalysisController(
      access as never,
      {} as never,
      identityBranches as never,
      {} as never,
      {} as never,
    );
    await expect(controller.reviseBranch(
      { teamId: "team-1", user: { id: "member-1" } },
      "project-1",
      {
        branch: "release",
        reason: "Promote release branch",
        expectedRevision: 1,
        idempotencyKey: "revision-key-1",
      },
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.assertWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: "project.repository_identity.branch.revise",
      risk: "high",
    }));
    expect(identityBranches.revise).not.toHaveBeenCalled();
  });
});
