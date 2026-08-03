import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseBuildRepository } from "./release-build.repository";
import type { ReleaseBuildInputSnapshot } from "./release-build.types";

const describeIntegration = process.env.RUN_RELEASE_BUILD_INTEGRATION === "1"
  ? describe
  : describe.skip;

describeIntegration("ReleaseBuild integration", () => {
  const prisma = new PrismaClient();
  const repository = new ReleaseBuildRepository(
    prisma as unknown as PrismaService,
  );
  const suffix = randomUUID();
  const userId = `build-user-${suffix}`;
  const teamId = `build-team-${suffix}`;
  const projectId = `build-project-${suffix}`;
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

  it("creates one immutable manifest only for a successful run", async () => {
    const failed = await repository.reserve(reservation());
    await repository.fail({
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
    await repository.succeed({
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
      logReference: `build-log://${succeeded.id}`,
      logSummary: { redacted: true, lines: ["ok"] },
      gateSummary: { build: { status: "passed" } },
    });
    await expect(
      prisma.artifactManifest.count({ where: { buildRunId: succeeded.id } }),
    ).resolves.toBe(1);
  });

  function reservation() {
    const snapshot: ReleaseBuildInputSnapshot = {
      version: 1,
      repositoryUrl: "https://example.com/repo.git",
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
    };
  }
});
