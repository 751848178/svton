import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseBuildRepository } from "./release-build.repository";
import { ReleaseBuildResultRepository } from "./release-build-result.repository";
import { ReleaseBuildService } from "./release-build.service";
import { presentBuild } from "./release-build.presenter";
import type { ReleaseBuildInputSnapshot } from "./release-build.types";

const describeIntegration = process.env.RUN_RELEASE_BUILD_INTEGRATION === "1"
  ? describe
  : describe.skip;

describeIntegration("ReleaseBuild integration", () => {
  const prisma = new PrismaClient();
  const repository = new ReleaseBuildRepository(
    prisma as unknown as PrismaService,
  );
  const results = new ReleaseBuildResultRepository(
    prisma as unknown as PrismaService,
  );
  const suffix = randomUUID();
  const userId = `build-user-${suffix}`;
  const teamId = `build-team-${suffix}`;
  const projectId = `build-project-${suffix}`;
  const identityId = `build-identity-${suffix}`;
  const revisionId = `build-identity-revision-${suffix}`;
  let orderId: string;

  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, email: `${suffix}@build.example`, role: "user" },
    });
    await prisma.team.create({ data: { id: teamId, name: "Build Team" } });
    await prisma.project.create({
      data: {
        id: projectId,
        teamId,
        createdById: userId,
        name: "Build Project",
        config: {},
      },
    });
    const connection = await prisma.repositoryConnection.create({
      data: {
        teamId,
        projectId,
        connectedById: userId,
        provider: "generic",
        repositoryUrl: "https://example.com/repo.git",
        defaultBranch: "main",
        selectedBranch: "main",
        commitSha: "a".repeat(40),
        status: "connected",
      },
    });
    await prisma.projectRepositoryIdentity.create({
      data: {
        id: identityId,
        teamId,
        projectId,
        repositoryConnectionId: connection.id,
        provider: "generic",
        canonicalKey: "example.com/repo",
        canonicalUrl: "https://example.com/repo",
        defaultBranch: "main",
        lockedAt: new Date(),
      },
    });
    await prisma.projectRepositoryIdentityRevision.create({
      data: {
        id: revisionId,
        teamId,
        projectId,
        identityId,
        createdById: userId,
        revision: 1,
        expectedRevision: 0,
        defaultBranch: "main",
        verifiedCommitSha: "a".repeat(40),
        reason: "integration fixture",
        idempotencyKey: `build-fixture-${suffix}`,
      },
    });
    await prisma.projectRepositoryIdentity.update({
      where: { id: identityId },
      data: { currentRevisionId: revisionId },
    });
    orderId = (await prisma.releaseOrder.create({
      data: {
        teamId,
        projectId,
        createdById: userId,
        releaseVersion: "1.0.0",
      },
    })).id;
  });

  afterAll(async () => {
    await prisma.team.delete({ where: { id: teamId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("allocates a monotonic revision for every independent build", async () => {
    const first = await repository.reserve(reservation());
    const second = await repository.reserve(reservation());
    expect([first.revision, second.revision]).toEqual([1, 2]);
    expect(first.sourceCommitSha).toBe("a".repeat(40));
    expect(second.sourceCommitSha).toBe("a".repeat(40));
  });

  it("keeps historical presentation frozen after joined identity mutation", async () => {
    const reserved = await repository.reserve(reservation());
    await prisma.projectRepositoryIdentity.update({
      where: { id: identityId },
      data: {
        provider: "mutated-provider",
        canonicalUrl: "https://mutated.example/repository",
      },
    });
    try {
      const listed = (await repository.list(teamId, projectId, orderId))
        .find((run) => run.id === reserved.id)!;
      expect(listed.repositoryIdentity).toMatchObject({
        provider: "mutated-provider",
        canonicalUrl: "https://mutated.example/repository",
      });
      expect(presentBuild(listed)).toMatchObject({
        sourceBranch: "main",
        sourceCommitSha: "a".repeat(40),
        sourceRepository: {
          provider: "generic",
          canonicalUrl: "https://example.com/repo",
          identityRevisionId: revisionId,
          identityRevision: 1,
          branch: "main",
        },
      });
    } finally {
      await prisma.projectRepositoryIdentity.update({
        where: { id: identityId },
        data: {
          provider: "generic",
          canonicalUrl: "https://example.com/repo",
        },
      });
    }
  });

  it("creates one immutable manifest only for a successful run", async () => {
    const failed = await repository.reserve(reservation());
    await results.fail({
      buildRunId: failed.id,
      code: "BUILD_COMMAND_FAILED",
      message: "failed",
      logReference: `build-log://${failed.id}`,
      logSummary: { redacted: true, lines: ["[REDACTED]"] },
      gateSummary: { build: { status: "failed" } },
    });
    await expect(
      prisma.artifactManifest.count({ where: { buildRunId: failed.id } }),
    ).resolves.toBe(0);

    const succeeded = await repository.reserve(reservation());
    await results.succeed({
      buildRunId: succeeded.id,
      teamId,
      projectId,
      releaseOrderId: orderId,
      digest: `sha256:${"b".repeat(64)}`,
      uri: `release-artifact://${succeeded.id}/bundle.zip`,
      sizeBytes: 42,
      sourceBranch: "main",
      sourceCommitSha: "a".repeat(40),
      inputHash: "input-hash",
      repositoryIdentityId: identityId,
      repositoryIdentityRevisionId: revisionId,
      repositoryProvider: "generic",
      canonicalRepositoryUrl: "https://example.com/repo",
      logReference: `build-log://${succeeded.id}`,
      logSummary: { redacted: true, lines: ["ok"] },
      gateSummary: { build: { status: "passed" } },
    });
    await expect(
      prisma.artifactManifest.count({ where: { buildRunId: succeeded.id } }),
    ).resolves.toBe(1);
  });

  it("creates no BuildRun and never invokes executor after cross-identity pointer drift", async () => {
    const before = await prisma.buildRun.count({ where: { projectId } });
    const otherProjectId = `build-other-project-${suffix}`;
    const otherIdentityId = `build-other-identity-${suffix}`;
    const otherRevisionId = `build-other-revision-${suffix}`;
    await prisma.project.create({
      data: {
        id: otherProjectId,
        teamId,
        createdById: userId,
        name: "Other Build Project",
        config: {},
      },
    });
    await prisma.projectRepositoryIdentity.create({
      data: {
        id: otherIdentityId,
        teamId,
        projectId: otherProjectId,
        provider: "generic",
        canonicalKey: "example.com/other",
        canonicalUrl: "https://example.com/other",
        defaultBranch: "main",
        lockedAt: new Date(),
      },
    });
    await prisma.projectRepositoryIdentityRevision.create({
      data: {
        id: otherRevisionId,
        teamId,
        projectId: otherProjectId,
        identityId: otherIdentityId,
        createdById: userId,
        revision: 1,
        expectedRevision: 0,
        defaultBranch: "main",
        verifiedCommitSha: "d".repeat(40),
        reason: "other fixture",
        idempotencyKey: `other-build-fixture-${suffix}`,
      },
    });
    const executor = { execute: jest.fn() };
    const checkout = jest.fn();
    const connection = await prisma.repositoryConnection.findUniqueOrThrow({
      where: { projectId },
    });
    const sources = {
      resolve: jest.fn(async () => {
        await prisma.projectRepositoryIdentity.update({
          where: { id: identityId },
          data: { currentRevisionId: otherRevisionId },
        });
        return {
          context: { project: { applications: [] } },
          connection,
          credential: { kind: "none" },
          identity: {
            id: identityId,
            revisionId,
            revision: 1,
            provider: "generic",
            canonicalKey: "example.com/repo",
            canonicalUrl: "https://example.com/repo",
            branch: "main",
          },
          commitSha: "a".repeat(40),
        };
      }),
    };
    const service = new ReleaseBuildService(
      repository,
      results,
      { checkout } as never,
      sources as never,
      executor as never,
    );
    try {
      await expect(service.build(teamId, userId, projectId, orderId))
        .rejects.toMatchObject({
          response: { code: "PROJECT_REPOSITORY_BUILD_SOURCE_DRIFT" },
        });
      await expect(prisma.buildRun.count({ where: { projectId } })).resolves.toBe(before);
      expect(checkout).not.toHaveBeenCalled();
      expect(executor.execute).not.toHaveBeenCalled();
    } finally {
      await prisma.projectRepositoryIdentity.update({
        where: { id: identityId },
        data: { currentRevisionId: revisionId },
      });
      await prisma.project.delete({ where: { id: otherProjectId } });
    }
  });

  function reservation() {
    const snapshot: ReleaseBuildInputSnapshot = {
      version: 2,
      repositoryUrl: "https://example.com/repo.git",
      repositoryIdentity: {
        id: identityId,
        revisionId,
        revision: 1,
        provider: "generic",
        canonicalUrl: "https://example.com/repo",
      },
      sourceBranch: "main",
      sourceCommitSha: "a".repeat(40),
      components: [{
        key: "app",
        name: "app",
        workingDirectory: ".",
        buildCommand: "npm run build",
      }],
    };
    return {
      teamId,
      projectId,
      releaseOrderId: orderId,
      actorId: userId,
      snapshot,
      inputHash: "input-hash",
      expectedCanonicalKey: "example.com/repo",
    };
  }
});
