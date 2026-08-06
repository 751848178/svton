import type { PrismaClient } from "@prisma/client";

export async function seedReleaseStagingProviderScope(
  prisma: PrismaClient,
  input: { suffix: string; userId: string; teamId: string; projectId: string },
) {
  await prisma.user.create({
    data: {
      id: input.userId,
      email: `${input.suffix}@staging.example`,
      role: "user",
    },
  });
  await prisma.team.create({
    data: { id: input.teamId, name: "Staging Team" },
  });
  await prisma.project.create({
    data: {
      id: input.projectId,
      teamId: input.teamId,
      createdById: input.userId,
      name: "Staging Project",
      config: {},
    },
  });
  const staging = await prisma.projectEnvironment.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      key: "staging",
      name: "Staging",
      baselineRole: "staging",
    },
  });
  const order = await prisma.releaseOrder.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      createdById: input.userId,
      releaseVersion: "1.0.0",
    },
  });
  const build = await prisma.buildRun.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      releaseOrderId: order.id,
      triggeredById: input.userId,
      revision: 1,
      sourceBranch: "main",
      sourceCommitSha: "a".repeat(40),
      inputSnapshot: {},
      inputHash: "hash",
      status: "succeeded",
    },
  });
  return { stagingId: staging.id, orderId: order.id, build };
}
