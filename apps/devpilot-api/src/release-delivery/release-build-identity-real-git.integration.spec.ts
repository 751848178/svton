import "reflect-metadata";
import { ReleaseBuildRealGitFixture } from "./release-build-real-git.fixture";

const describeIntegration =
  process.env.RUN_F416_IDENTITY_INTEGRATION === "1" ? describe : describe.skip;

describeIntegration("F416 real Git identity and build source", () => {
  const fixture = new ReleaseBuildRealGitFixture();

  beforeAll(() => fixture.start());
  afterAll(() => fixture.stop());

  it("revises a real branch, replays offline, and builds its latest exact commit", async () => {
    const fingerprintBefore = await fixture.fingerprint();
    const request = {
      branch: "release",
      reason: "Promote verified release branch",
      expectedRevision: 1,
      idempotencyKey: `real-git-revision-${fixture.suffix}`,
    };
    const revised = await fixture.branches.revise(
      fixture.teamId,
      fixture.userId,
      fixture.projectId,
      request,
    );
    expect(revised).toMatchObject({
      revision: 2,
      defaultBranch: "release",
      commitSha: fixture.releaseCommit,
      replayed: false,
    });

    await fixture.takeOffline();
    const replayed = await fixture.branches.revise(
      fixture.teamId,
      fixture.userId,
      fixture.projectId,
      request,
    );
    expect(replayed).toMatchObject({
      revisionId: revised.revisionId,
      commitSha: fixture.releaseCommit,
      replayed: true,
    });
    await fixture.restoreOnline();

    const latestReleaseCommit = await fixture.advanceRelease();
    const build = await fixture.service.build(
      fixture.teamId,
      fixture.userId,
      fixture.projectId,
      fixture.orderId,
    );
    expect(build).toMatchObject({
      status: "succeeded",
      sourceBranch: "release",
      sourceCommitSha: latestReleaseCommit,
      sourceRepository: {
        provider: "local",
        identityRevisionId: revised.revisionId,
        identityRevision: 2,
        branch: "release",
      },
    });
    expect(fixture.executedCommits).toEqual([latestReleaseCommit]);
    const stored = await fixture.prisma.buildRun.findUniqueOrThrow({
      where: { id: build.id },
    });
    expect(stored.repositoryIdentityRevisionId).toBe(revised.revisionId);
    expect(stored.inputSnapshot).toMatchObject({
      version: 3,
      repositoryIdentity: {
        revisionId: revised.revisionId,
        revision: 2,
        provider: "local",
      },
      sourceBranch: "release",
      sourceCommitSha: latestReleaseCommit,
      runtime: { profile: "controlled-local-v1" },
    });
    await expect(
      fixture.prisma.auditEvent.count({
        where: {
          projectId: fixture.projectId,
          action: "project.repository_identity.branch.revise",
        },
      }),
    ).resolves.toBe(1);
    await expect(fixture.fingerprint()).resolves.toEqual(fingerprintBefore);
  });
});
