import { Prisma } from "@prisma/client";

export function releaseOrderResumeStepCte() {
  return Prisma.sql`
    furthest_release_phase AS (
      SELECT releaseOrderId,
        CASE MAX(CASE phase
          WHEN 'preflight' THEN 0
          WHEN 'build' THEN 1
          WHEN 'staging' THEN 2
          WHEN 'production' THEN 3
          ELSE -1
        END)
          WHEN 0 THEN 'preflight'
          WHEN 1 THEN 'build'
          WHEN 2 THEN 'staging'
          WHEN 3 THEN 'production'
          ELSE NULL
        END AS resumeStep
      FROM lifecycle_events
      GROUP BY releaseOrderId
    )
  `;
}
