import type { Prisma } from "@prisma/client";
import { assertProjectWritable } from "../project/project-archived-write.error";

export async function loadWritableRepositoryProject(
  tx: Prisma.TransactionClient,
  teamId: string,
  projectId: string,
) {
  const project = await tx.project.findFirstOrThrow({
    where: { id: projectId, teamId },
    select: {
      archivedAt: true,
      onboardingStatus: true,
      repositoryConnection: true,
      repositoryIdentity: {
        select: {
          id: true,
          projectId: true,
          provider: true,
          canonicalKey: true,
          canonicalUrl: true,
          lockedAt: true,
          currentRevision: {
            select: {
              id: true,
              revision: true,
              defaultBranch: true,
              reason: true,
              createdAt: true,
              identityId: true,
              projectId: true,
            },
          },
        },
      },
      repositoryAnalysisRuns: {
        where: { status: { in: ["queued", "running"] } },
        take: 1,
        select: { id: true },
      },
    },
  });
  assertProjectWritable(project);
  return project;
}
