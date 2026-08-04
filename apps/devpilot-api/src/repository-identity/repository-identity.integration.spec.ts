import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { RepositoryAnalysisRunClaimRepository } from "../repository-analysis/repository-analysis-run-claim.repository";
import { RepositoryIdentityConnectionRepository } from "./repository-identity-connection.repository";
import { RepositoryIdentityCoordinatorService } from "./repository-identity-coordinator.service";
import { RepositoryIdentityRevisionRepository } from "./repository-identity-revision.repository";

const describeIntegration = process.env.RUN_F416_IDENTITY_INTEGRATION === "1"
  ? describe
  : describe.skip;

describeIntegration("F416 repository identity MySQL boundaries", () => {
  const prisma = new PrismaClient();
  const db = prisma as unknown as PrismaService;
  const coordinator = new RepositoryIdentityCoordinatorService(db);
  const connections = new RepositoryIdentityConnectionRepository(coordinator);
  const revisions = new RepositoryIdentityRevisionRepository(coordinator);
  const claims = new RepositoryAnalysisRunClaimRepository(coordinator);
  const suffix = randomUUID();
  const teamId = `f416-team-${suffix}`;
  const userId = `f416-user-${suffix}`;
  const projectId = `f416-project-${suffix}`;
  const duplicateProjectId = `f416-duplicate-${suffix}`;
  const legacyProjectId = `f416-legacy-${suffix}`;
  const revisionGapProjectId = `f416-revision-gap-${suffix}`;

  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, email: `${suffix}@f416.example`, role: "user" },
    });
    await prisma.team.create({ data: { id: teamId, name: "F416 Team" } });
    await createProject(projectId, "ready");
    await createProject(duplicateProjectId, "draft");
    await createProject(legacyProjectId, "ready");
    await createProject(revisionGapProjectId, "ready");
    await seedLockedIdentity();
    await prisma.repositoryConnection.create({
      data: connectionData(legacyProjectId, "https://github.com/example/legacy.git"),
    });
    const revisionGapConnection = await prisma.repositoryConnection.create({
      data: connectionData(
        revisionGapProjectId,
        "https://github.com/example/revision-gap.git",
      ),
    });
    await prisma.projectRepositoryIdentity.create({
      data: {
        teamId,
        projectId: revisionGapProjectId,
        repositoryConnectionId: revisionGapConnection.id,
        provider: "github",
        canonicalKey: "github.com/example/revision-gap",
        canonicalUrl: "https://github.com/example/revision-gap",
        defaultBranch: "main",
        lockedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.team.delete({ where: { id: teamId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("allows same-identity aliases and rejects duplicate, replacement and forged provider", async () => {
    const alias = await connections.saveVerified(verifiedInput(
      projectId,
      "git@github.com:example/service.git",
      "github",
      "main",
    ));
    expect(alias.repositoryUrl).toBe("git@github.com:example/service.git");

    await expect(connections.saveVerified(verifiedInput(
      duplicateProjectId,
      "https://github.com/Example/Service.git",
      "github",
      "main",
    ))).rejects.toMatchObject({ response: { code: "PROJECT_REPOSITORY_DUPLICATE" } });
    await expect(prisma.repositoryConnection.count({
      where: { projectId: duplicateProjectId },
    })).resolves.toBe(0);

    const before = await prisma.repositoryConnection.findUniqueOrThrow({
      where: { projectId },
    });
    await expect(connections.saveVerified(verifiedInput(
      projectId,
      "https://github.com/example/other.git",
      "github",
      "main",
    ))).rejects.toMatchObject({ response: { code: "PROJECT_REPOSITORY_IDENTITY_LOCKED" } });
    await expect(connections.saveVerified(verifiedInput(
      projectId,
      "https://github.com/example/service.git",
      "gitlab",
      "main",
    ))).rejects.toMatchObject({ response: { code: "PROJECT_REPOSITORY_PROVIDER_DRIFT" } });
    await expect(prisma.repositoryConnection.findUniqueOrThrow({ where: { projectId } }))
      .resolves.toEqual(before);
  });

  it("fails closed for READY legacy projects and active analysis", async () => {
    await expect(connections.saveVerified(verifiedInput(
      legacyProjectId,
      "https://github.com/example/legacy.git",
      "github",
      "main",
    ))).rejects.toMatchObject({
      response: { code: "PROJECT_REPOSITORY_IDENTITY_MIGRATION_REQUIRED" },
    });
    await expect(claims.start({
      teamId,
      projectId: legacyProjectId,
      triggeredById: userId,
      branch: "main",
      idempotencyKey: `legacy-start-${suffix}`,
      parserVersion: "f416",
    })).rejects.toMatchObject({
      response: { code: "PROJECT_REPOSITORY_IDENTITY_MIGRATION_REQUIRED" },
    });
    await expect(connections.saveVerified(verifiedInput(
      revisionGapProjectId,
      "https://github.com/example/revision-gap.git",
      "github",
      "main",
    ))).rejects.toMatchObject({
      response: { code: "PROJECT_REPOSITORY_IDENTITY_MIGRATION_REQUIRED" },
    });
    await expect(claims.start({
      teamId,
      projectId: revisionGapProjectId,
      triggeredById: userId,
      branch: "main",
      idempotencyKey: `revision-gap-start-${suffix}`,
      parserVersion: "f416",
    })).rejects.toMatchObject({
      response: { code: "PROJECT_REPOSITORY_IDENTITY_MIGRATION_REQUIRED" },
    });

    const connection = await prisma.repositoryConnection.findUniqueOrThrow({
      where: { projectId },
    });
    const run = await prisma.repositoryAnalysisRun.create({
      data: {
        teamId,
        projectId,
        connectionId: connection.id,
        triggeredById: userId,
        repositoryUrl: connection.repositoryUrl,
        branch: "main",
        commitSha: connection.commitSha!,
        status: "running",
        activeKey: "active",
        idempotencyKey: `active-${suffix}`,
        parserVersion: "f416",
      },
    });
    const activeCount = await prisma.repositoryAnalysisRun.count({
      where: { projectId, status: { in: ["queued", "running"] } },
    });
    await expect(connections.saveVerified(verifiedInput(
      projectId,
      connection.repositoryUrl,
      "github",
      "main",
    ))).rejects.toMatchObject({ response: { code: "REPOSITORY_ANALYSIS_ACTIVE" } });
    await expect(revisions.append(revisionInput("release", 1, `active-revise-${suffix}`)))
      .rejects.toMatchObject({ response: { code: "REPOSITORY_ANALYSIS_ACTIVE" } });
    await expect(claims.start({
      teamId,
      projectId,
      triggeredById: userId,
      branch: "main",
      idempotencyKey: `active-start-${suffix}`,
      parserVersion: "f416",
    })).rejects.toMatchObject({ response: { code: "REPOSITORY_ANALYSIS_ACTIVE" } });
    await expect(prisma.repositoryAnalysisRun.count({
      where: { projectId, status: { in: ["queued", "running"] } },
    })).resolves.toBe(activeCount);
    await prisma.repositoryAnalysisRun.update({
      where: { id: run.id },
      data: { status: "cancelled", activeKey: null },
    });
  });

  it("provides CAS, exact replay and one atomic audit per effective revision", async () => {
    const first = await revisions.append(revisionInput("release", 1, `revise-1-${suffix}`));
    expect(first.revision.revision).toBe(2);
    const replay = await revisions.append(revisionInput("release", 1, `revise-1-${suffix}`));
    expect(replay).toMatchObject({ replayed: true, revision: { id: first.revision.id } });
    await expect(revisions.append({
      ...revisionInput("other", 1, `revise-1-${suffix}`),
      reason: "Different replay request",
    })).rejects.toMatchObject({
      response: { code: "PROJECT_REPOSITORY_REVISION_IDEMPOTENCY_CONFLICT" },
    });
    await expect(revisions.append(revisionInput("stale", 1, `stale-${suffix}`)))
      .rejects.toMatchObject({ response: { code: "PROJECT_REPOSITORY_REVISION_STALE" } });

    const contenders = await Promise.allSettled([
      revisions.append(revisionInput("release-a", 2, `race-a-${suffix}`)),
      revisions.append(revisionInput("release-b", 2, `race-b-${suffix}`)),
    ]);
    expect(contenders.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(contenders.filter((item) => item.status === "rejected")).toHaveLength(1);
    await expect(prisma.projectRepositoryIdentityRevision.count({
      where: { projectId, revision: 3 },
    })).resolves.toBe(1);
    await expect(prisma.auditEvent.count({
      where: {
        projectId,
        action: "project.repository_identity.branch.revise",
        risk: "high",
      },
    })).resolves.toBe(2);
    const identity = await prisma.projectRepositoryIdentity.findUniqueOrThrow({
      where: { projectId },
      include: { currentRevision: true },
    });
    expect(identity.currentRevision?.revision).toBe(3);
    expect(identity.currentRevision?.identityId).toBe(identity.id);
  });

  async function createProject(id: string, onboardingStatus: string) {
    await prisma.project.create({
      data: {
        id,
        teamId,
        createdById: userId,
        name: id,
        config: {},
        onboardingStatus,
      },
    });
  }

  async function seedLockedIdentity() {
    const connection = await prisma.repositoryConnection.create({
      data: connectionData(projectId, "https://github.com/example/service.git"),
    });
    const identity = await prisma.projectRepositoryIdentity.create({
      data: {
        teamId,
        projectId,
        repositoryConnectionId: connection.id,
        provider: "github",
        canonicalKey: "github.com/example/service",
        canonicalUrl: "https://github.com/example/service",
        defaultBranch: "main",
        lockedAt: new Date(),
      },
    });
    const revision = await prisma.projectRepositoryIdentityRevision.create({
      data: {
        teamId,
        projectId,
        identityId: identity.id,
        createdById: userId,
        revision: 1,
        expectedRevision: 0,
        defaultBranch: "main",
        verifiedCommitSha: "a".repeat(40),
        reason: "Initial identity",
        idempotencyKey: `initial-${suffix}`,
      },
    });
    await prisma.projectRepositoryIdentity.update({
      where: { id: identity.id },
      data: { currentRevisionId: revision.id },
    });
  }

  function connectionData(targetProjectId: string, repositoryUrl: string) {
    return {
      teamId,
      projectId: targetProjectId,
      connectedById: userId,
      provider: "github",
      repositoryUrl,
      visibility: "public",
      credentialSource: "none",
      defaultBranch: "main",
      selectedBranch: "main",
      commitSha: "a".repeat(40),
      branches: ["main", "release", "release-a", "release-b"],
      status: "connected",
    };
  }

  function verifiedInput(
    targetProjectId: string,
    repositoryUrl: string,
    provider: string,
    branch: string,
  ) {
    return {
      teamId,
      projectId: targetProjectId,
      userId,
      repositoryUrl,
      provider,
      visibility: "public",
      credentialSource: "none",
      defaultBranch: branch,
      selectedBranch: branch,
      commitSha: "b".repeat(40),
      branches: [branch],
    };
  }

  function revisionInput(branch: string, expectedRevision: number, idempotencyKey: string) {
    return {
      teamId,
      projectId,
      actorId: userId,
      branch,
      commitSha: branch.padEnd(40, "c").slice(0, 40),
      reason: `Promote ${branch} branch`,
      expectedRevision,
      idempotencyKey,
      repositoryUrl: "git@github.com:example/service.git",
      provider: "github",
    };
  }
});
