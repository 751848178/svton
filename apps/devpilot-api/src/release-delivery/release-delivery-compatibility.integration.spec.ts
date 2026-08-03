import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectArchiveService } from "../project/project-archive.service";
import { ReleaseDeliveryCompatibilityRepository } from "./release-delivery-compatibility.repository";
import { ReleaseDeliveryCompatibilityService } from "./release-delivery-compatibility.service";

const describeIntegration = process.env.RUN_RELEASE_PRODUCTION_INTEGRATION === "1"
  ? describe
  : describe.skip;

describeIntegration("Release delivery compatibility integration", () => {
  const suffix = randomUUID();
  const userId = `compat-user-${suffix}`;
  const teamId = `compat-team-${suffix}`;
  const projectId = `compat-project-${suffix}`;
  const prisma = new PrismaClient();
  const prismaService = prisma as unknown as PrismaService;

  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, email: `${suffix}@compat.example` },
    });
    await prisma.team.create({ data: { id: teamId, name: "Compat Team" } });
    await prisma.project.create({
      data: {
        id: projectId,
        teamId,
        createdById: userId,
        name: "Legacy Project",
        config: {},
        onboardingStatus: "ready",
      },
    });
    const environment = await prisma.projectEnvironment.create({
      data: { teamId, projectId, key: "production", name: "Production" },
    });
    await prisma.deploymentRun.create({
      data: {
        teamId,
        projectId,
        environmentId: environment.id,
        targetType: "docker-compose",
        status: "completed",
        logs: ["legacy deployment log"],
        result: { artifactDigest: "sha256:observed-only" },
      },
    });
  });

  afterAll(async () => {
    await prisma.team.delete({ where: { id: teamId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("archives without deleting runs/logs and keeps inferred digests unverified", async () => {
    await new ProjectArchiveService(prismaService)
      .archive(teamId, userId, projectId);
    const compatibility = await new ReleaseDeliveryCompatibilityService(
      new ReleaseDeliveryCompatibilityRepository(prismaService),
    ).get(teamId, projectId);
    expect(compatibility.project).toMatchObject({
      onboardingStatus: "archived",
      archivedAt: expect.any(Date),
    });
    expect(compatibility.report.summary).toMatchObject({
      linkedDeploymentRuns: 0,
      syntheticManifests: 0,
      unverified: 2,
    });
    expect(compatibility.history.deploymentRuns[0]).toMatchObject({
      classification: "legacy_unverified",
      logsRetained: true,
      readOnly: true,
    });
    await expect(prisma.deploymentRun.count({ where: { projectId } }))
      .resolves.toBe(1);
    await expect(prisma.auditEvent.count({
      where: { projectId, action: "project.archive" },
    })).resolves.toBe(1);
  });
});

