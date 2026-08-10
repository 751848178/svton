import type { PrismaClient } from "@prisma/client";

export async function seedReleaseStagingNegativeManifests(
  prisma: PrismaClient,
  current: {
    suffix: string;
    userId: string;
    teamId: string;
    projectId: string;
    orderId: string;
  },
) {
  const crossOrder = await createOrder(prisma, {
    teamId: current.teamId,
    projectId: current.projectId,
    userId: current.userId,
    suffix: `${current.suffix}-order`,
  });
  const crossProjectId = `staging-foreign-project-${current.suffix}`;
  await prisma.project.create({
    data: {
      id: crossProjectId,
      teamId: current.teamId,
      createdById: current.userId,
      name: "Foreign Project",
      config: {},
    },
  });
  const crossProject = await createOrder(prisma, {
    teamId: current.teamId,
    projectId: crossProjectId,
    userId: current.userId,
    suffix: `${current.suffix}-project`,
  });
  const foreignUserId = `staging-foreign-user-${current.suffix}`;
  const foreignTeamId = `staging-foreign-team-${current.suffix}`;
  const foreignProjectId = `staging-foreign-team-project-${current.suffix}`;
  await prisma.user.create({
    data: {
      id: foreignUserId,
      email: `${current.suffix}-foreign@staging.example`,
      role: "user",
    },
  });
  await prisma.team.create({
    data: { id: foreignTeamId, name: "Foreign Team" },
  });
  await prisma.project.create({
    data: {
      id: foreignProjectId,
      teamId: foreignTeamId,
      createdById: foreignUserId,
      name: "Foreign Team Project",
      config: {},
    },
  });
  const crossTeam = await createOrder(prisma, {
    teamId: foreignTeamId,
    projectId: foreignProjectId,
    userId: foreignUserId,
    suffix: `${current.suffix}-team`,
  });
  const driftBuild = await createBuild(prisma, {
    teamId: current.teamId,
    projectId: current.projectId,
    orderId: crossOrder.orderId,
    userId: current.userId,
    revision: 2,
    status: "succeeded",
  });
  const scopeDrift = await createManifest(prisma, {
    teamId: current.teamId,
    projectId: current.projectId,
    orderId: current.orderId,
    buildId: driftBuild.id,
  });
  const failedBuild = await createBuild(prisma, {
    teamId: current.teamId,
    projectId: current.projectId,
    orderId: current.orderId,
    userId: current.userId,
    revision: 3,
    status: "failed",
  });
  const failed = await createManifest(prisma, {
    teamId: current.teamId,
    projectId: current.projectId,
    orderId: current.orderId,
    buildId: failedBuild.id,
  });
  return {
    crossOrder: crossOrder.manifestId,
    crossProject: crossProject.manifestId,
    crossTeam: crossTeam.manifestId,
    scopeDrift: scopeDrift.id,
    failed: failed.id,
    cleanup: async () => {
      await prisma.team.delete({ where: { id: foreignTeamId } });
      await prisma.user.delete({ where: { id: foreignUserId } });
    },
  };
}

async function createOrder(
  prisma: PrismaClient,
  input: { teamId: string; projectId: string; userId: string; suffix: string },
) {
  const order = await prisma.releaseOrder.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      createdById: input.userId,
      releaseVersion: input.suffix,
    },
  });
  const build = await createBuild(prisma, {
    ...input,
    orderId: order.id,
    revision: 1,
    status: "succeeded",
  });
  const manifest = await createManifest(prisma, {
    ...input,
    orderId: order.id,
    buildId: build.id,
  });
  return { orderId: order.id, manifestId: manifest.id };
}

function createBuild(
  prisma: PrismaClient,
  input: {
    teamId: string;
    projectId: string;
    orderId: string;
    userId: string;
    revision: number;
    status: "succeeded" | "failed";
  },
) {
  return prisma.buildRun.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      releaseOrderId: input.orderId,
      triggeredById: input.userId,
      revision: input.revision,
      sourceBranch: "main",
      sourceCommitSha: "f".repeat(40),
      inputSnapshot: {},
      inputHash: `${input.orderId}-${input.revision}`,
      status: input.status,
    },
  });
}

function createManifest(
  prisma: PrismaClient,
  input: {
    teamId: string;
    projectId: string;
    orderId: string;
    buildId: string;
  },
) {
  return prisma.artifactManifest.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      releaseOrderId: input.orderId,
      buildRunId: input.buildId,
      digest: `sha256:${"d".repeat(64)}`,
    },
  });
}
