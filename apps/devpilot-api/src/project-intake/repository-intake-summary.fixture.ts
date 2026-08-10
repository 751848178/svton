import type { RepositoryIntakeSummarySource } from "./repository-intake-summary.types";

type FrozenFinalization =
  RepositoryIntakeSummarySource["intakeFinalizations"][number];

export function frozenRepositoryIntakeFinalization(
  projectId: string,
  decisions: unknown,
  finishedAt = new Date("2026-08-04T00:05:00.000Z"),
): FrozenFinalization {
  const snapshotId = "snapshot-1";
  const snapshotHash = "c".repeat(64);
  return {
    teamId: "team-1",
    projectId,
    status: "succeeded",
    resultSnapshot: {
      projectId,
      reviewSnapshotId: snapshotId,
      reviewSnapshotHash: snapshotHash,
    },
    finishedAt,
    analysisRun: {
      teamId: "team-1",
      projectId,
      status: "succeeded",
      intakeReviewSnapshot: {
        id: snapshotId,
        teamId: "team-1",
        projectId,
        snapshotHash,
        decisions,
      },
    },
  };
}
