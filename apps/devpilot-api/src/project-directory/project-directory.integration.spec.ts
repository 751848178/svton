import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import type { ControlAccessPolicyService } from "../control-access-policy";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectDirectoryQueryDto } from "./dto/project-directory-query.dto";
import { ProjectDirectoryRepository } from "./project-directory.repository";
import { ProjectDirectoryService } from "./project-directory.service";

const describeIntegration =
  process.env.RUN_PROJECT_DIRECTORY_INTEGRATION === "1"
    ? describe
    : describe.skip;

describeIntegration("project directory real MySQL integration", () => {
  const prisma = new PrismaClient();
  const repository = new ProjectDirectoryRepository(
    prisma as unknown as PrismaService,
  );
  const access = {
    canRead: jest.fn().mockResolvedValue(true),
  } as unknown as ControlAccessPolicyService;
  const service = new ProjectDirectoryService(repository, access);
  const suffix = randomUUID();
  const userId = `user-${suffix}`;
  const teamA = `team-a-${suffix}`;
  const teamB = `team-b-${suffix}`;
  const onlineId = `online-${suffix}`;
  const needsId = `needs-${suffix}`;
  const stagingId = `staging-${suffix}`;
  const productionId = `production-${suffix}`;
  const siteId = `site-${suffix}`;

  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, email: `${suffix}@example.com`, role: "user" },
    });
    await prisma.team.createMany({
      data: [
        { id: teamA, name: "Team A" },
        { id: teamB, name: "Team B" },
      ],
    });
    await seedOnlineProject();
    await seedProject(prisma, userId, teamA, needsId, "Needs Setup");
    await seedProject(
      prisma,
      userId,
      teamB,
      `private-${suffix}`,
      "Private Project",
    );
  });

  afterAll(() => prisma.$disconnect());

  it("returns online and needs-configuration from exact relations with team isolation", async () => {
    const result = await service.list(
      teamA,
      userId,
      new ProjectDirectoryQueryDto(),
    );

    expect(result.summary).toEqual({
      total: 2,
      online: 1,
      needsConfiguration: 1,
    });
    expect(result.scope).toEqual({ teamId: teamA, actorId: userId });
    expect(result.items.map(({ id }) => id)).not.toContain(`private-${suffix}`);
    expect(result.items.find(({ id }) => id === onlineId)).toMatchObject({
      status: "online",
      intake: {
        projectType: "web_application",
        architecture: "monorepo",
        componentCount: 1,
      },
      production: { currentVersion: "2.3.2", domain: "payments.example.com" },
      activity: { id: `analysis-late-${suffix}`, type: "analysis" },
    });
  });

  it.each([["Payments"], ["git.example/payments"], ["payments.example.com"]])(
    "searches name, canonical repository and Production domain: %s",
    async (query) => {
      const input = Object.assign(new ProjectDirectoryQueryDto(), { query });
      const result = await service.list(teamA, userId, input);

      expect(result.items.map(({ id }) => id)).toEqual([onlineId]);
    },
  );

  it("applies the single server-side status parameter", async () => {
    const input = Object.assign(new ProjectDirectoryQueryDto(), {
      status: "online" as const,
    });
    const result = await service.list(teamA, userId, input);

    expect(result.items.map(({ status }) => status)).toEqual(["online"]);
  });

  it("requires an exact active Production Site for online and domain search", async () => {
    const exactSite = {
      teamId: teamA,
      createdById: userId,
      projectId: onlineId,
      environmentId: productionId,
      name: "Payments Production",
      primaryDomain: "payments.example.com",
      status: "active",
    };
    const assertNeedsConfiguration = async () => {
      const directory = await service.list(
        teamA,
        userId,
        new ProjectDirectoryQueryDto(),
      );
      expect(directory.items.find(({ id }) => id === onlineId)).toMatchObject({
        status: "needs_configuration",
        production: { currentVersion: "2.3.2", domain: null },
      });
      expect(directory.summary).toEqual({
        total: 2,
        online: 0,
        needsConfiguration: 2,
      });

      const domainSearch = Object.assign(new ProjectDirectoryQueryDto(), {
        query: "payments.example.com",
      });
      expect(
        (await service.list(teamA, userId, domainSearch)).items,
      ).toHaveLength(0);

      const onlineFilter = Object.assign(new ProjectDirectoryQueryDto(), {
        status: "online" as const,
      });
      expect(
        (await service.list(teamA, userId, onlineFilter)).items,
      ).toHaveLength(0);
    };

    try {
      await prisma.site.delete({ where: { id: siteId } });
      await assertNeedsConfiguration();

      await prisma.site.create({
        data: { id: siteId, ...exactSite, status: "pending" },
      });
      await assertNeedsConfiguration();

      await prisma.site.update({
        where: { id: siteId },
        data: { status: "active", teamId: teamB },
      });
      await assertNeedsConfiguration();

      await prisma.site.update({
        where: { id: siteId },
        data: { teamId: teamA, projectId: needsId },
      });
      await assertNeedsConfiguration();

      await prisma.site.update({
        where: { id: siteId },
        data: { projectId: onlineId, environmentId: stagingId },
      });
      await assertNeedsConfiguration();

      await prisma.site.update({
        where: { id: siteId },
        data: { environmentId: productionId, primaryDomain: "  " },
      });
      await assertNeedsConfiguration();
    } finally {
      await prisma.site.upsert({
        where: { id: siteId },
        create: { id: siteId, ...exactSite },
        update: exactSite,
      });
    }

    const restored = await service.list(
      teamA,
      userId,
      new ProjectDirectoryQueryDto(),
    );
    expect(restored.items.find(({ id }) => id === onlineId)).toMatchObject({
      status: "online",
      production: {
        currentVersion: "2.3.2",
        domain: "payments.example.com",
      },
    });
  });

  async function seedOnlineProject() {
    const connectionId = `connection-${suffix}`;
    const identityId = `identity-${suffix}`;
    const revisionId = `identity-revision-${suffix}`;
    const analysisId = `analysis-${suffix}`;
    const commit = "a".repeat(40);
    await prisma.project.create({
      data: {
        id: onlineId,
        teamId: teamA,
        createdById: userId,
        name: "Payments",
        config: intakeConfig(),
        onboardingStatus: "ready",
        onboardingRevision: 1,
        onboardingFinalizedAt: new Date("2026-08-03T01:00:00.000Z"),
      },
    });
    await prisma.repositoryConnection.create({
      data: {
        id: connectionId,
        teamId: teamA,
        projectId: onlineId,
        provider: "generic",
        repositoryUrl: "https://git.example/payments.git",
        defaultBranch: "main",
        selectedBranch: "main",
        commitSha: commit,
        status: "connected",
      },
    });
    await prisma.projectRepositoryIdentity.create({
      data: {
        id: identityId,
        teamId: teamA,
        projectId: onlineId,
        repositoryConnectionId: connectionId,
        provider: "generic",
        canonicalKey: "git.example/payments",
        canonicalUrl: "https://git.example/payments",
        defaultBranch: "main",
        lockedAt: new Date(),
      },
    });
    await prisma.projectRepositoryIdentityRevision.create({
      data: {
        id: revisionId,
        teamId: teamA,
        projectId: onlineId,
        identityId,
        revision: 1,
        expectedRevision: 0,
        defaultBranch: "main",
        verifiedCommitSha: commit,
        reason: "initial",
        idempotencyKey: `identity-${suffix}`,
      },
    });
    await prisma.projectRepositoryIdentity.update({
      where: { id: identityId },
      data: { currentRevisionId: revisionId },
    });
    await prisma.repositoryAnalysisRun.create({
      data: {
        id: analysisId,
        teamId: teamA,
        projectId: onlineId,
        connectionId,
        repositoryUrl: "https://git.example/payments.git",
        branch: "main",
        commitSha: commit,
        status: "succeeded",
        idempotencyKey: `analysis-${suffix}`,
        parserVersion: "integration",
        createdAt: new Date("2026-08-04T01:00:00.000Z"),
        finishedAt: new Date("2026-08-04T02:00:00.000Z"),
      },
    });
    await prisma.repositoryAnalysisRun.create({
      data: {
        id: `analysis-late-${suffix}`,
        teamId: teamA,
        projectId: onlineId,
        connectionId,
        repositoryUrl: "https://git.example/payments.git",
        branch: "main",
        commitSha: commit,
        status: "succeeded",
        idempotencyKey: `analysis-late-${suffix}`,
        parserVersion: "integration",
        createdAt: new Date("2026-08-01T01:00:00.000Z"),
        finishedAt: new Date("2026-08-05T01:00:00.000Z"),
      },
    });
    const reviewSnapshot = await prisma.repositoryIntakeReviewSnapshot.create({
      data: {
        id: `snapshot-${suffix}`,
        teamId: teamA,
        projectId: onlineId,
        runId: analysisId,
        version: 1,
        inputHash: "b".repeat(64),
        snapshotHash: suffix.replaceAll("-", "").repeat(2),
        branch: "main",
        commitSha: commit,
        parserVersion: "integration",
        decisions: intakeDecisions(),
        references: [],
      },
    });
    await prisma.projectIntakeFinalization.create({
      data: {
        teamId: teamA,
        projectId: onlineId,
        analysisRunId: analysisId,
        actorId: userId,
        idempotencyKey: `finalization-${suffix}`,
        inputHash: "f".repeat(64),
        status: "succeeded",
        resultSnapshot: {
          projectId: onlineId,
          reviewSnapshotId: reviewSnapshot.id,
          reviewSnapshotHash: reviewSnapshot.snapshotHash,
        },
        finishedAt: new Date("2026-08-04T03:00:00.000Z"),
      },
    });
    await seedEnvironment(stagingId, "staging", 20);
    await seedEnvironment(productionId, "production", 30);
    await seedProductionVersion(productionId, commit);
  }

  async function seedEnvironment(id: string, role: string, sortOrder: number) {
    await prisma.projectEnvironment.create({
      data: {
        id,
        teamId: teamA,
        projectId: onlineId,
        key: role,
        name: role,
        baselineRole: role,
        sortOrder,
        identityLockedAt: new Date(),
      },
    });
    const configId = `config-${role}-${suffix}`;
    await prisma.environmentConfigRevision.create({
      data: {
        id: configId,
        teamId: teamA,
        projectId: onlineId,
        environmentId: id,
        revision: 1,
        snapshotHash: `${role}-${suffix}`,
      },
    });
    await prisma.projectEnvironment.update({
      where: { id },
      data: { currentConfigRevisionId: configId },
    });
  }

  async function seedProductionVersion(environmentId: string, commit: string) {
    const order = await prisma.releaseOrder.create({
      data: { teamId: teamA, projectId: onlineId, releaseVersion: "2.3.2" },
    });
    const build = await prisma.buildRun.create({
      data: {
        teamId: teamA,
        projectId: onlineId,
        releaseOrderId: order.id,
        revision: 1,
        sourceBranch: "main",
        sourceCommitSha: commit,
        inputSnapshot: {},
        inputHash: "d".repeat(64),
        status: "succeeded",
      },
    });
    const manifest = await prisma.artifactManifest.create({
      data: {
        teamId: teamA,
        projectId: onlineId,
        releaseOrderId: order.id,
        buildRunId: build.id,
        digest: `sha256:${"e".repeat(64)}`,
      },
    });
    const deployment = await prisma.deploymentRun.create({
      data: {
        teamId: teamA,
        projectId: onlineId,
        environmentId,
        artifactManifestId: manifest.id,
        source: "release_order",
        targetType: "server",
        dryRun: false,
        status: "completed",
      },
    });
    const version = await prisma.environmentVersion.create({
      data: {
        teamId: teamA,
        projectId: onlineId,
        environmentId,
        releaseOrderId: order.id,
        artifactManifestId: manifest.id,
        deploymentRunId: deployment.id,
        effectiveAt: new Date(),
      },
    });
    await prisma.projectEnvironment.update({
      where: { id: environmentId },
      data: { currentEnvironmentVersionId: version.id },
    });
    await prisma.site.create({
      data: {
        id: siteId,
        teamId: teamA,
        createdById: userId,
        projectId: onlineId,
        environmentId,
        name: "Payments Production",
        primaryDomain: "payments.example.com",
        status: "active",
      },
    });
  }
});

async function seedProject(
  prisma: PrismaClient,
  userId: string,
  teamId: string,
  projectId: string,
  name: string,
) {
  await prisma.project.create({
    data: { id: projectId, teamId, createdById: userId, name, config: {} },
  });
}

function intakeConfig() {
  return {
    repositoryAnalysis: {
      intakeContract: {
        version: 1,
        overview: { projectType: "web_application", architecture: "monorepo" },
      },
    },
  };
}

function intakeDecisions() {
  return [
    {
      kind: "project_repository",
      decision: "accept",
      reviewedValue: {
        intakeContract: intakeConfig().repositoryAnalysis.intakeContract,
      },
    },
    {
      kind: "application_service",
      decision: "accept",
      reviewedValue: {
        metadata: {
          repositoryAnalysis: {
            intakeContract: { name: "api", path: "apps/api" },
          },
        },
      },
    },
  ];
}
