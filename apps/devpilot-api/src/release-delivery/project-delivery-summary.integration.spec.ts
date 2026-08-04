import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectDeliverySummaryRepository } from "./project-delivery-summary.repository";
import { ProjectDeliverySummaryService } from "./project-delivery-summary.service";

const describeIntegration =
  process.env.RUN_PROJECT_DELIVERY_SUMMARY_INTEGRATION === "1"
    ? describe
    : describe.skip;

describeIntegration("project delivery summary real MySQL integration", () => {
  const prisma = new PrismaClient();
  const repository = new ProjectDeliverySummaryRepository(
    prisma as unknown as PrismaService,
  );
  const service = new ProjectDeliverySummaryService(repository);
  const suffix = randomUUID();
  const userId = `f418-user-${suffix}`;
  const teamId = `f418-team-${suffix}`;
  const otherTeamId = `f418-other-team-${suffix}`;
  const projectId = `f418-project-${suffix}`;
  const otherProjectId = `f418-other-project-${suffix}`;
  const noFinalizationProjectId = `f418-no-finalization-${suffix}`;
  const finalizationId = `f418-finalization-${suffix}`;
  const reviewSnapshotId = `f418-snapshot-${suffix}`;
  const reviewSnapshotHash = `${suffix.replaceAll("-", "")}${"c".repeat(32)}`;
  const stagingId = `f418-staging-${suffix}`;
  const productionId = `f418-production-${suffix}`;
  const stagingDeploymentId = `f418-deploy-staging-${suffix}`;

  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, email: `${suffix}@f418.example`, role: "user" },
    });
    await prisma.team.createMany({
      data: [
        { id: teamId, name: "F418 Team" },
        { id: otherTeamId, name: "F418 Other Team" },
      ],
    });
    await seedProject();
  });

  afterAll(() => prisma.$disconnect());

  it("reads exact intake, baseline, binding, Site and version relations", async () => {
    const result = await service.get(teamId, userId, projectId);

    expect(result).toMatchObject({
      scope: { teamId, actorId: userId, projectId },
      repository: {
        canonicalUrl: "https://github.com/example/f418",
        defaultBranch: "main",
      },
      intake: {
        projectType: "web_application",
        architecture: "monorepo",
        componentCount: 1,
      },
      baselines: { staging: { ready: true }, production: { ready: true } },
      resources: { bound: 4, total: 6 },
      entries: { active: 1, total: 2, unit: "site" },
      currentVersions: {
        staging: { releaseVersion: "2.4.0-rc.1" },
        production: { releaseVersion: "2.3.2" },
      },
    });
  });

  it("fails finalization result id, hash and project drift closed", async () => {
    const originalResult = finalizationResult(
      projectId,
      reviewSnapshotId,
      reviewSnapshotHash,
    );
    for (const resultSnapshot of [
      { ...originalResult, reviewSnapshotId: "wrong-snapshot" },
      { ...originalResult, reviewSnapshotHash: "wrong-hash" },
      { ...originalResult, projectId: otherProjectId },
    ]) {
      await prisma.projectIntakeFinalization.update({
        where: { id: finalizationId },
        data: { resultSnapshot },
      });
      expect((await service.get(teamId, userId, projectId)).intake).toEqual(
        emptyIntake(),
      );
    }
    await prisma.projectIntakeFinalization.update({
      where: { id: finalizationId },
      data: { resultSnapshot: originalResult },
    });
  });

  it("fails finalization and review snapshot scope or status drift closed", async () => {
    await prisma.projectIntakeFinalization.update({
      where: { id: finalizationId },
      data: { teamId: otherTeamId },
    });
    expect((await service.get(teamId, userId, projectId)).intake).toEqual(
      emptyIntake(),
    );
    await prisma.projectIntakeFinalization.update({
      where: { id: finalizationId },
      data: { teamId, finishedAt: null },
    });
    expect((await service.get(teamId, userId, projectId)).intake).toEqual(
      emptyIntake(),
    );
    await prisma.projectIntakeFinalization.update({
      where: { id: finalizationId },
      data: { finishedAt: new Date(), status: "pending" },
    });
    expect((await service.get(teamId, userId, projectId)).intake).toEqual(
      emptyIntake(),
    );
    await prisma.projectIntakeFinalization.update({
      where: { id: finalizationId },
      data: { status: "succeeded" },
    });
    await prisma.repositoryIntakeReviewSnapshot.update({
      where: { id: reviewSnapshotId },
      data: { teamId: otherTeamId, projectId: otherProjectId },
    });
    expect((await service.get(teamId, userId, projectId)).intake).toEqual(
      emptyIntake(),
    );
    await prisma.repositoryIntakeReviewSnapshot.update({
      where: { id: reviewSnapshotId },
      data: { teamId, projectId },
    });
  });

  it("does not use mutable config or an unfinalized review snapshot", async () => {
    const main = await service.get(teamId, userId, projectId);
    expect(main.intake).toEqual({
      projectType: "web_application",
      architecture: "monorepo",
      componentCount: 1,
    });
    const missing = await service.get(teamId, userId, noFinalizationProjectId);
    expect(missing.intake).toEqual(emptyIntake());
  });

  it("fails a dry-run current-version pointer closed", async () => {
    await prisma.deploymentRun.update({
      where: { id: stagingDeploymentId },
      data: { dryRun: true },
    });
    const result = await service.get(teamId, userId, projectId);
    expect(result.currentVersions.staging).toBeNull();
    expect(result.currentVersions.production?.releaseVersion).toBe("2.3.2");
    await prisma.deploymentRun.update({
      where: { id: stagingDeploymentId },
      data: { dryRun: false },
    });
  });

  it("cannot reuse a project across team or actor response scope", async () => {
    await expect(
      service.get(otherTeamId, userId, projectId),
    ).rejects.toMatchObject({
      status: 404,
    });
    const otherActor = await service.get(teamId, "actor-other", projectId);
    expect(otherActor.scope).toEqual({
      teamId,
      actorId: "actor-other",
      projectId,
    });
  });

  async function seedProject() {
    await prisma.project.create({
      data: {
        id: otherProjectId,
        teamId: otherTeamId,
        createdById: userId,
        name: "F418 Other",
        config: {},
      },
    });
    await prisma.project.create({
      data: {
        id: noFinalizationProjectId,
        teamId,
        createdById: userId,
        name: "F418 Mutable Only",
        config: mutableIntakeConfig(),
      },
    });
    await prisma.project.create({
      data: {
        id: projectId,
        teamId,
        createdById: userId,
        name: "F418",
        config: mutableIntakeConfig(),
      },
    });
    const connection = await prisma.repositoryConnection.create({
      data: {
        teamId,
        projectId,
        provider: "github",
        repositoryUrl: "git@github.com:example/f418.git",
        defaultBranch: "main",
        selectedBranch: "main",
        commitSha: "a".repeat(40),
        status: "connected",
      },
    });
    const identity = await prisma.projectRepositoryIdentity.create({
      data: {
        teamId,
        projectId,
        repositoryConnectionId: connection.id,
        provider: "github",
        canonicalKey: "github.com/example/f418",
        canonicalUrl: "https://github.com/example/f418",
        lockedAt: new Date(),
      },
    });
    const revision = await prisma.projectRepositoryIdentityRevision.create({
      data: {
        teamId,
        projectId,
        identityId: identity.id,
        revision: 1,
        expectedRevision: 0,
        defaultBranch: "main",
        verifiedCommitSha: "a".repeat(40),
        reason: "F418 exact identity",
        idempotencyKey: `identity-${suffix}`,
      },
    });
    await prisma.projectRepositoryIdentity.update({
      where: { id: identity.id },
      data: { currentRevisionId: revision.id },
    });
    const run = await prisma.repositoryAnalysisRun.create({
      data: {
        teamId,
        projectId,
        connectionId: connection.id,
        repositoryUrl: connection.repositoryUrl,
        branch: "main",
        commitSha: "a".repeat(40),
        status: "succeeded",
        idempotencyKey: `analysis-${suffix}`,
        parserVersion: "f418-v1",
      },
    });
    await prisma.repositoryIntakeReviewSnapshot.create({
      data: {
        id: reviewSnapshotId,
        teamId,
        projectId,
        runId: run.id,
        actorId: userId,
        inputHash: `${suffix.replaceAll("-", "")}${"b".repeat(32)}`,
        snapshotHash: reviewSnapshotHash,
        branch: "main",
        commitSha: "a".repeat(40),
        parserVersion: "f418-v1",
        decisions: intakeDecisions(),
        references: [],
      },
    });
    await prisma.projectIntakeFinalization.create({
      data: {
        id: finalizationId,
        teamId,
        projectId,
        analysisRunId: run.id,
        actorId: userId,
        idempotencyKey: `finalization-${suffix}`,
        inputHash: "9".repeat(64),
        status: "succeeded",
        resultSnapshot: finalizationResult(
          projectId,
          reviewSnapshotId,
          reviewSnapshotHash,
        ),
        finishedAt: new Date(),
      },
    });
    const laterRun = await prisma.repositoryAnalysisRun.create({
      data: {
        teamId,
        projectId,
        connectionId: connection.id,
        repositoryUrl: connection.repositoryUrl,
        branch: "main",
        commitSha: "e".repeat(40),
        status: "succeeded",
        idempotencyKey: `analysis-later-${suffix}`,
        parserVersion: "f418-v2-unfinalized",
      },
    });
    await prisma.repositoryIntakeReviewSnapshot.create({
      data: {
        teamId,
        projectId,
        runId: laterRun.id,
        actorId: userId,
        inputHash: `${suffix.replaceAll("-", "")}${"d".repeat(32)}`,
        snapshotHash: `${suffix.replaceAll("-", "")}${"e".repeat(32)}`,
        branch: "main",
        commitSha: "e".repeat(40),
        parserVersion: "f418-v2-unfinalized",
        decisions: [],
        references: [],
      },
    });
    await seedEnvironment(
      stagingId,
      "staging",
      "2.4.0-rc.1",
      stagingDeploymentId,
    );
    await seedEnvironment(
      productionId,
      "production",
      "2.3.2",
      `f418-deploy-production-${suffix}`,
    );
    await seedResources();
  }

  async function seedEnvironment(
    environmentId: string,
    role: "staging" | "production",
    releaseVersion: string,
    deploymentId: string,
  ) {
    await prisma.projectEnvironment.create({
      data: {
        id: environmentId,
        teamId,
        projectId,
        key: role,
        name: role,
        status: "active",
        baselineRole: role,
        identityLockedAt: new Date(),
      },
    });
    const config = await prisma.environmentConfigRevision.create({
      data: {
        teamId,
        projectId,
        environmentId,
        revision: 1,
        snapshotHash: `${role}-${suffix}`,
      },
    });
    const order = await prisma.releaseOrder.create({
      data: { teamId, projectId, releaseVersion },
    });
    const build = await prisma.buildRun.create({
      data: {
        teamId,
        projectId,
        releaseOrderId: order.id,
        revision: 1,
        sourceBranch: "main",
        sourceCommitSha: "d".repeat(40),
        inputSnapshot: {},
        inputHash: `${role === "staging" ? "e" : "f"}`.repeat(64),
        status: "succeeded",
      },
    });
    const manifest = await prisma.artifactManifest.create({
      data: {
        teamId,
        projectId,
        releaseOrderId: order.id,
        buildRunId: build.id,
        digest: `sha256:${(role === "staging" ? "1" : "2").repeat(64)}`,
      },
    });
    await prisma.deploymentRun.create({
      data: {
        id: deploymentId,
        teamId,
        projectId,
        environmentId,
        artifactManifestId: manifest.id,
        source: "release_order",
        targetType: "release-artifact",
        dryRun: false,
        status: "completed",
      },
    });
    const version = await prisma.environmentVersion.create({
      data: {
        teamId,
        projectId,
        environmentId,
        releaseOrderId: order.id,
        artifactManifestId: manifest.id,
        deploymentRunId: deploymentId,
        effectiveAt: new Date(),
      },
    });
    await prisma.projectEnvironment.update({
      where: { id: environmentId },
      data: {
        currentConfigRevisionId: config.id,
        currentEnvironmentVersionId: version.id,
      },
    });
  }

  async function seedResources() {
    const resourceType = await prisma.resourceType.create({
      data: { key: `f418-${suffix}`, name: "F418 Resource" },
    });
    await prisma.resourceInstance.create({
      data: {
        teamId,
        projectId,
        environmentId: stagingId,
        resourceTypeId: resourceType.id,
        name: "database",
      },
    });
    await prisma.managedResource.create({
      data: {
        teamId,
        projectId,
        environmentId: productionId,
        sourceType: "manual",
        provider: "docker",
        kind: "database",
        name: "managed database",
        externalId: `f418-managed-${suffix}`,
      },
    });
    await prisma.secretKey.create({
      data: {
        teamId,
        createdById: userId,
        projectId,
        name: "F418 reference",
        type: "custom",
        value: "encrypted-reference",
      },
    });
    const credential = await prisma.teamCredential.create({
      data: {
        teamId,
        type: "cdn_test",
        name: "F418 CDN",
        config: "encrypted-reference",
      },
    });
    await prisma.cDNConfig.create({
      data: {
        teamId,
        createdById: userId,
        projectId,
        environmentId: productionId,
        credentialId: credential.id,
        name: "F418 CDN",
        domain: "cdn.f418.example",
        origin: "origin.f418.example",
        provider: "test",
      },
    });
    await prisma.site.createMany({
      data: [
        {
          teamId,
          createdById: userId,
          projectId,
          environmentId: productionId,
          name: "Production Site",
          primaryDomain: "f418.example",
          status: "active",
        },
        {
          teamId,
          createdById: userId,
          projectId,
          name: "Preview Site",
          primaryDomain: "preview.f418.example",
          status: "draft",
        },
      ],
    });
  }
});

function intakeDecisions() {
  return [
    {
      kind: "project_repository",
      decision: "accept",
      reviewedValue: {
        intakeContract: {
          overview: {
            projectType: "web_application",
            architecture: "monorepo",
          },
        },
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

function emptyIntake() {
  return { projectType: null, architecture: null, componentCount: null };
}

function finalizationResult(
  projectId: string,
  reviewSnapshotId: string,
  reviewSnapshotHash: string,
) {
  return {
    projectId,
    reviewSnapshotId,
    reviewSnapshotHash,
  };
}

function mutableIntakeConfig() {
  return {
    repositoryAnalysis: {
      intakeContract: {
        overview: {
          projectType: "static_site",
          architecture: "single_repository",
        },
      },
    },
  };
}
