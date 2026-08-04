import type { RepositoryIntakeSummarySource } from "./repository-intake-summary.types";
import { repositoryIntakeSummary } from "./repository-intake-summary.utils";

const EMPTY = {
  projectType: null,
  architecture: null,
  componentCount: null,
};

describe("repositoryIntakeSummary", () => {
  it("uses only the exact succeeded finalization review snapshot", () => {
    const input = source() as RepositoryIntakeSummarySource & {
      config: unknown;
      repositoryIntakeReviewSnapshots: unknown[];
    };
    input.config = mutableConfig();
    input.repositoryIntakeReviewSnapshots = [{ decisions: [] }];

    expect(repositoryIntakeSummary(input)).toEqual({
      projectType: "web_application",
      architecture: "monorepo",
      componentCount: 1,
    });
  });

  it.each([
    [
      "no finalization",
      (input: RepositoryIntakeSummarySource) =>
        (input.intakeFinalizations = []),
    ],
    [
      "pending",
      (input: RepositoryIntakeSummarySource) =>
        (input.intakeFinalizations[0].status = "pending"),
    ],
    [
      "failed",
      (input: RepositoryIntakeSummarySource) =>
        (input.intakeFinalizations[0].status = "failed"),
    ],
    [
      "missing finishedAt",
      (input: RepositoryIntakeSummarySource) =>
        (input.intakeFinalizations[0].finishedAt = null),
    ],
    [
      "finalization team",
      (input: RepositoryIntakeSummarySource) =>
        (input.intakeFinalizations[0].teamId = "other-team"),
    ],
    [
      "finalization project",
      (input: RepositoryIntakeSummarySource) =>
        (input.intakeFinalizations[0].projectId = "other-project"),
    ],
    [
      "analysis status",
      (input: RepositoryIntakeSummarySource) =>
        (input.intakeFinalizations[0].analysisRun.status = "failed"),
    ],
    [
      "analysis team",
      (input: RepositoryIntakeSummarySource) =>
        (input.intakeFinalizations[0].analysisRun.teamId = "other-team"),
    ],
    [
      "analysis project",
      (input: RepositoryIntakeSummarySource) =>
        (input.intakeFinalizations[0].analysisRun.projectId = "other-project"),
    ],
    [
      "missing snapshot",
      (input: RepositoryIntakeSummarySource) =>
        (input.intakeFinalizations[0].analysisRun.intakeReviewSnapshot = null),
    ],
    [
      "snapshot team",
      (input: RepositoryIntakeSummarySource) =>
        setSnapshotScope(input, "teamId", "other-team"),
    ],
    [
      "snapshot project",
      (input: RepositoryIntakeSummarySource) =>
        setSnapshotScope(input, "projectId", "other-project"),
    ],
    [
      "result project",
      (input: RepositoryIntakeSummarySource) =>
        setResult(input, { projectId: "other-project" }),
    ],
    [
      "snapshot id",
      (input: RepositoryIntakeSummarySource) =>
        setResult(input, { reviewSnapshotId: "other-snapshot" }),
    ],
    [
      "snapshot hash",
      (input: RepositoryIntakeSummarySource) =>
        setResult(input, { reviewSnapshotHash: "other-hash" }),
    ],
    [
      "missing result",
      (input: RepositoryIntakeSummarySource) =>
        (input.intakeFinalizations[0].resultSnapshot = null),
    ],
  ])("fails the whole summary closed for %s drift", (_label, mutate) => {
    const input = source();
    mutate(input);
    expect(repositoryIntakeSummary(input)).toEqual(EMPTY);
  });

  it("never falls back to mutable project config", () => {
    const input = {
      ...source(),
      intakeFinalizations: [],
      config: mutableConfig(),
    };
    expect(repositoryIntakeSummary(input)).toEqual(EMPTY);
  });
});

function source(): RepositoryIntakeSummarySource {
  const snapshotHash = "c".repeat(64);
  return {
    id: "project-1",
    teamId: "team-1",
    intakeFinalizations: [
      {
        teamId: "team-1",
        projectId: "project-1",
        status: "succeeded",
        finishedAt: new Date("2026-08-05T00:00:00.000Z"),
        resultSnapshot: {
          projectId: "project-1",
          reviewSnapshotId: "snapshot-1",
          reviewSnapshotHash: snapshotHash,
        },
        analysisRun: {
          teamId: "team-1",
          projectId: "project-1",
          status: "succeeded",
          intakeReviewSnapshot: {
            id: "snapshot-1",
            teamId: "team-1",
            projectId: "project-1",
            snapshotHash,
            decisions: decisions(),
          },
        },
      },
    ],
  };
}

function setResult(
  input: RepositoryIntakeSummarySource,
  override: Record<string, string>,
) {
  input.intakeFinalizations[0].resultSnapshot = {
    ...(input.intakeFinalizations[0].resultSnapshot as Record<string, string>),
    ...override,
  };
}

function setSnapshotScope(
  input: RepositoryIntakeSummarySource,
  key: "teamId" | "projectId",
  value: string,
) {
  const snapshot =
    input.intakeFinalizations[0].analysisRun.intakeReviewSnapshot;
  if (!snapshot) throw new Error("fixture must contain a review snapshot");
  snapshot[key] = value;
}

function decisions() {
  return [
    {
      kind: "project_repository",
      decision: "accept",
      reviewedValue: {
        intakeContract: {
          overview: {
            projectType: "web_application",
            architecture: "monorepo",
          },
        },
      },
    },
    {
      kind: "application_service",
      decision: "accept",
      reviewedValue: {
        metadata: {
          repositoryAnalysis: {
            intakeContract: { name: "web", path: "apps/web" },
          },
        },
      },
    },
  ];
}

function mutableConfig() {
  return {
    repositoryAnalysis: {
      intakeContract: {
        overview: {
          projectType: "static_site",
          architecture: "single_repository",
        },
      },
    },
  };
}
