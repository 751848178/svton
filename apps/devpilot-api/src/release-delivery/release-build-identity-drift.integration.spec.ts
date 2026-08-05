import "reflect-metadata";
import { gatePolicyTestDouble } from "./release-gate-test-decision.spec-utils";
import { ReleaseBuildRuntimeFixture } from "./release-build-runtime.integration-fixture";
import { ReleaseBuildService } from "./release-build.service";

const describeIntegration =
  process.env.RUN_RELEASE_BUILD_INTEGRATION === "1" ? describe : describe.skip;

describeIntegration("ReleaseBuild repository identity drift", () => {
  const fixture = new ReleaseBuildRuntimeFixture();

  beforeAll(() => fixture.start());
  afterAll(() => fixture.stop());

  it("creates no BuildRun after a cross-project identity pointer drift", async () => {
    const otherProjectId = `f426-other-project-${fixture.suffix}`;
    const otherIdentityId = `f426-other-identity-${fixture.suffix}`;
    const otherRevisionId = `f426-other-revision-${fixture.suffix}`;
    await fixture.prisma.project.create({
      data: {
        id: otherProjectId,
        teamId: fixture.teamId,
        createdById: fixture.userId,
        name: "Other Project",
        config: {},
      },
    });
    await fixture.prisma.projectRepositoryIdentity.create({
      data: {
        id: otherIdentityId,
        teamId: fixture.teamId,
        projectId: otherProjectId,
        provider: "generic",
        canonicalKey: "example.com/other",
        canonicalUrl: "https://example.com/other",
        defaultBranch: "main",
        lockedAt: new Date(),
      },
    });
    await fixture.prisma.projectRepositoryIdentityRevision.create({
      data: {
        id: otherRevisionId,
        teamId: fixture.teamId,
        projectId: otherProjectId,
        identityId: otherIdentityId,
        createdById: fixture.userId,
        revision: 1,
        expectedRevision: 0,
        defaultBranch: "main",
        verifiedCommitSha: "d".repeat(40),
        reason: "drift fixture",
        idempotencyKey: `other-${fixture.suffix}`,
      },
    });
    const connection =
      await fixture.prisma.repositoryConnection.findUniqueOrThrow({
        where: { projectId: fixture.projectId },
      });
    const runner = { run: jest.fn() };
    const sources = {
      resolve: jest.fn(async () => {
        await fixture.prisma.projectRepositoryIdentity.update({
          where: { id: fixture.identityId },
          data: { currentRevisionId: otherRevisionId },
        });
        return source(connection, fixture);
      }),
    };
    const service = new ReleaseBuildService(
      fixture.repository,
      sources as never,
      gatePolicyTestDouble(fixture.prisma) as never,
      runner as never,
      runtime() as never,
      supervisor() as never,
    );
    try {
      await expect(
        service.build(
          fixture.teamId,
          fixture.userId,
          fixture.projectId,
          fixture.orderId,
        ),
      ).rejects.toMatchObject({
        response: { code: "PROJECT_REPOSITORY_BUILD_SOURCE_DRIFT" },
      });
      await expect(
        fixture.prisma.buildRun.count({
          where: { projectId: fixture.projectId },
        }),
      ).resolves.toBe(0);
      expect(runner.run).not.toHaveBeenCalled();
    } finally {
      await fixture.prisma.projectRepositoryIdentity.update({
        where: { id: fixture.identityId },
        data: { currentRevisionId: fixture.identityRevisionId },
      });
      await fixture.prisma.project.delete({ where: { id: otherProjectId } });
    }
  });
});

function source(connection: unknown, fixture: ReleaseBuildRuntimeFixture) {
  return {
    context: { project: { applications: [] } },
    connection,
    credential: { kind: "none" },
    identity: {
      id: fixture.identityId,
      revisionId: fixture.identityRevisionId,
      revision: 1,
      provider: "generic",
      canonicalKey: "example.com/repo",
      canonicalUrl: "https://example.com/repo",
      branch: "main",
    },
    commitSha: "a".repeat(40),
  };
}

function runtime() {
  return {
    assertAvailable: jest.fn(),
    descriptor: jest.fn(() => ({
      profile: "controlled-local-v1",
      runTimeoutMs: 1,
      commandTimeoutMs: 1,
      cancelGraceMs: 1,
      maxConcurrency: 1,
      concurrencyScope: "single-process",
      workspacePolicy: "dedicated-build-root",
      environmentKeys: [],
    })),
  };
}

function supervisor() {
  return {
    run: (task: (scope: unknown) => Promise<unknown>) =>
      task({
        signal: new AbortController().signal,
        bind: jest.fn(),
      }),
  };
}
