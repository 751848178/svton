import { Prisma } from "@prisma/client";

export const FROZEN_REPOSITORY_INTAKE_FINALIZATIONS_SELECT = {
  where: { status: "succeeded" },
  orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
  take: 1,
  select: {
    teamId: true,
    projectId: true,
    status: true,
    resultSnapshot: true,
    finishedAt: true,
    analysisRun: {
      select: {
        teamId: true,
        projectId: true,
        status: true,
        intakeReviewSnapshot: {
          select: {
            id: true,
            teamId: true,
            projectId: true,
            snapshotHash: true,
            decisions: true,
          },
        },
      },
    },
  },
} satisfies Prisma.Project$intakeFinalizationsArgs;
