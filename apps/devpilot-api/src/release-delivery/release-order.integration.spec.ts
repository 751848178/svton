import "reflect-metadata";
import { ConflictException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseOrderRepository } from "./release-order.repository";
import { ReleaseOrderDetailRepository } from "./release-order-detail.repository";
import { ReleaseOrderService } from "./release-order.service";

const describeIntegration =
  process.env.RUN_RELEASE_ORDER_INTEGRATION === "1" ? describe : describe.skip;

describeIntegration("ReleaseOrder integration", () => {
  const prisma = new PrismaClient();
  const repository = new ReleaseOrderRepository(
    prisma as unknown as PrismaService,
  );
  const detailRepository = new ReleaseOrderDetailRepository(
    prisma as unknown as PrismaService,
  );
  const service = new ReleaseOrderService(repository, detailRepository);
  const suffix = randomUUID();
  const userId = `release-user-${suffix}`;
  const teamId = `release-team-${suffix}`;
  const projectId = `release-project-${suffix}`;

  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, email: `${suffix}@release.example`, role: "user" },
    });
    await prisma.team.create({ data: { id: teamId, name: "Release Team" } });
    await prisma.project.create({
      data: {
        id: projectId,
        teamId,
        createdById: userId,
        name: "Release Project",
        config: {},
      },
    });
  });

  afterAll(async () => {
    await prisma.team.delete({ where: { id: teamId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("creates idempotently without an implicit build or manifest", async () => {
    const first = await service.create(teamId, userId, projectId, {
      releaseVersion: "2.4.1",
      note: "Production release",
    });
    const replay = await service.create(teamId, userId, projectId, {
      releaseVersion: "2.4.1",
      note: "Production release",
    });
    const detail = await service.get(teamId, projectId, first.id);
    expect(replay).toEqual(first);
    expect(detail).toEqual(first);
    expect(first).not.toHaveProperty("status");
    expect(first).toHaveProperty("persistedStatus", "draft");
    expect(first).toHaveProperty("lifecycle.status", "draft");
    await expect(
      prisma.releaseOrder.count({ where: { projectId } }),
    ).resolves.toBe(1);
    await expect(prisma.buildRun.count({ where: { projectId } })).resolves.toBe(
      0,
    );
    await expect(
      prisma.artifactManifest.count({ where: { projectId } }),
    ).resolves.toBe(0);
  });

  it("converges concurrent identical creates on one order", async () => {
    const [first, second] = await Promise.all([
      service.create(teamId, userId, projectId, {
        releaseVersion: "2.4.2",
        note: "Concurrent release",
      }),
      service.create(teamId, userId, projectId, {
        releaseVersion: "2.4.2",
        note: "Concurrent release",
      }),
    ]);
    expect(second).toEqual(first);
    await expect(
      prisma.releaseOrder.count({
        where: { projectId, releaseVersion: "2.4.2" },
      }),
    ).resolves.toBe(1);
  });

  it("rejects a conflicting note and isolates commands by team/project", async () => {
    await expect(
      service.create(teamId, userId, projectId, {
        releaseVersion: "2.4.1",
        note: "Changed note",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.create("another-team", userId, projectId, {
        releaseVersion: "2.4.3",
      }),
    ).rejects.toThrow();
  });
});
