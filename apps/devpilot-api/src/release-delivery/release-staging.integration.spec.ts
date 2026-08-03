import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseStagingRepository } from "./release-staging.repository";
import { ReleaseStagingService } from "./release-staging.service";

const describeIntegration = process.env.RUN_RELEASE_STAGING_INTEGRATION === "1"
  ? describe
  : describe.skip;

describeIntegration("ReleaseStaging integration", () => {
  const prisma = new PrismaClient();
  const repository = new ReleaseStagingRepository(
    prisma as unknown as PrismaService,
  );
  const executor = {
    deploy: jest.fn(async (input) => ({
      deploymentUri: `release-deployment://${input.deploymentRunId}`,
      logs: ["verified", "materialized"],
      evidence: { buildInvoked: false, gitInvoked: false, artifactVerified: true },
    })),
  };
  const service = new ReleaseStagingService(repository, executor as never);
  const suffix = randomUUID();
  const userId = `staging-user-${suffix}`;
  const teamId = `staging-team-${suffix}`;
  const projectId = `staging-project-${suffix}`;
  let orderId: string;
  let manifestId: string;

  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, email: `${suffix}@staging.example`, role: "user" },
    });
    await prisma.team.create({ data: { id: teamId, name: "Staging Team" } });
    await prisma.project.create({
      data: { id: projectId, teamId, createdById: userId, name: "Staging Project", config: {} },
    });
    await prisma.projectEnvironment.create({
      data: {
        teamId,
        projectId,
        key: "staging",
        name: "Staging",
        baselineRole: "staging",
      },
    });
    orderId = (await prisma.releaseOrder.create({
      data: { teamId, projectId, createdById: userId, releaseVersion: "1.0.0" },
    })).id;
    const build = await prisma.buildRun.create({
      data: {
        teamId,
        projectId,
        releaseOrderId: orderId,
        triggeredById: userId,
        revision: 1,
        sourceBranch: "main",
        sourceCommitSha: "a".repeat(40),
        inputSnapshot: {},
        inputHash: "hash",
        status: "succeeded",
      },
    });
    manifestId = (await prisma.artifactManifest.create({
      data: {
        teamId,
        projectId,
        releaseOrderId: orderId,
        buildRunId: build.id,
        digest: `sha256:${"b".repeat(64)}`,
        items: {
          create: [{
            componentKey: "project-bundle",
            artifactType: "zip",
            uri: `release-artifact://${build.id}/bundle.zip`,
            digest: `sha256:${"b".repeat(64)}`,
          }],
        },
      },
    })).id;
  });

  afterAll(async () => {
    await prisma.team.delete({ where: { id: teamId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("repeats the exact Manifest without creating another BuildRun", async () => {
    const beforeBuilds = await prisma.buildRun.count({ where: { releaseOrderId: orderId } });
    const first = await service.deploy(input());
    const second = await service.deploy(input());
    expect(first.id).not.toBe(second.id);
    expect(first.artifactManifestId).toBe(manifestId);
    expect(second.artifactManifestId).toBe(manifestId);
    await expect(
      prisma.deploymentRun.count({ where: { artifactManifestId: manifestId } }),
    ).resolves.toBe(2);
    await expect(
      prisma.buildRun.count({ where: { releaseOrderId: orderId } }),
    ).resolves.toBe(beforeBuilds);
    const rows = await prisma.deploymentRun.findMany({
      where: { artifactManifestId: manifestId },
      select: { commandPlan: true, status: true },
    });
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "completed" }),
    ]));
    expect(JSON.stringify(rows)).toContain('"build":false');
  });

  function input() {
    return {
      teamId,
      actorId: userId,
      projectId,
      releaseOrderId: orderId,
      manifestId,
    };
  }
});
