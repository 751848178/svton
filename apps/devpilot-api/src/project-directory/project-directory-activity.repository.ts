import { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";

export interface ProjectDirectoryActivityRecord {
  id: string;
  projectId: string;
  activityType: string;
  status: string;
  summary: string | null;
  occurredAt: Date;
}

export async function recentProjectActivity(
  prisma: PrismaService,
  teamId: string,
): Promise<Map<string, ProjectDirectoryActivityRecord>> {
  const rows = await prisma.$queryRaw<ProjectDirectoryActivityRecord[]>(
    Prisma.sql`
      SELECT id, projectId, activityType, status, summary, occurredAt
      FROM (
        SELECT candidates.*,
          ROW_NUMBER() OVER (
            PARTITION BY projectId
            ORDER BY occurredAt DESC, id ASC, activityType ASC
          ) AS activityRank
        FROM (
          SELECT id, projectId, 'analysis' AS activityType, status,
            NULL AS summary, COALESCE(finishedAt, createdAt) AS occurredAt
          FROM RepositoryAnalysisRun WHERE teamId = ${teamId}
          UNION ALL
          SELECT id, projectId, 'deployment', status,
            NULL, COALESCE(finishedAt, createdAt)
          FROM DeploymentRun WHERE teamId = ${teamId}
          UNION ALL
          SELECT id, projectId, 'release', status, releaseVersion, updatedAt
          FROM ReleaseOrder WHERE teamId = ${teamId}
          UNION ALL
          SELECT id, projectId, 'audit', status,
            COALESCE(summary, action), occurredAt
          FROM AuditEvent WHERE teamId = ${teamId} AND projectId IS NOT NULL
          UNION ALL
          SELECT id, projectId, 'intake', 'completed', NULL, createdAt
          FROM RepositoryIntakeReviewSnapshot WHERE teamId = ${teamId}
          UNION ALL
          SELECT id, id, 'project', COALESCE(onboardingStatus, 'unknown'),
            NULL, updatedAt
          FROM Project
          WHERE teamId = ${teamId} AND archivedAt IS NULL
        ) AS candidates
      ) AS ranked
      WHERE activityRank = 1
    `,
  );
  return new Map(rows.map((row) => [row.projectId, row]));
}
