import type { PrismaClient } from "@prisma/client";
import { normalizeRepositoryIdentity } from "../repository-identity/repository-identity.utils";

export async function seedReleaseBuildRealGitDatabase(input: {
  prisma: PrismaClient;
  suffix: string;
  teamId: string;
  userId: string;
  projectId: string;
  repositoryRoot: string;
  mainCommit: string;
}) {
  await input.prisma.project.create({
    data: {
      id: input.projectId,
      teamId: input.teamId,
      createdById: input.userId,
      name: "F416 Real Git",
      config: {},
      onboardingStatus: "ready",
    },
  });
  const connection = await input.prisma.repositoryConnection.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      connectedById: input.userId,
      provider: "local",
      repositoryUrl: input.repositoryRoot,
      visibility: "public",
      credentialSource: "none",
      defaultBranch: "main",
      selectedBranch: "main",
      commitSha: input.mainCommit,
      branches: ["main", "release"],
      status: "connected",
    },
  });
  const normalized = normalizeRepositoryIdentity(input.repositoryRoot);
  if (!normalized) throw new Error("F426 repository fixture is not canonical");
  const identity = await input.prisma.projectRepositoryIdentity.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      repositoryConnectionId: connection.id,
      provider: normalized.provider,
      canonicalKey: normalized.canonicalKey,
      canonicalUrl: normalized.canonicalUrl,
      defaultBranch: "main",
      lockedAt: new Date(),
    },
  });
  const revision = await input.prisma.projectRepositoryIdentityRevision.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      identityId: identity.id,
      createdById: input.userId,
      revision: 1,
      expectedRevision: 0,
      defaultBranch: "main",
      verifiedCommitSha: input.mainCommit,
      reason: "Initial main branch",
      idempotencyKey: `real-git-initial-${input.suffix}`,
    },
  });
  await input.prisma.projectRepositoryIdentity.update({
    where: { id: identity.id },
    data: { currentRevisionId: revision.id },
  });
  return (
    await input.prisma.releaseOrder.create({
      data: {
        teamId: input.teamId,
        projectId: input.projectId,
        createdById: input.userId,
        releaseVersion: "1.0.0",
      },
    })
  ).id;
}
