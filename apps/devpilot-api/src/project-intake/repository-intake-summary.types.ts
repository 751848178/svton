export interface RepositoryIntakeSummarySource {
  id: string;
  teamId: string;
  intakeFinalizations: Array<{
    teamId: string;
    projectId: string;
    status: string;
    resultSnapshot: unknown;
    finishedAt: Date | null;
    analysisRun: {
      teamId: string;
      projectId: string;
      status: string;
      intakeReviewSnapshot: {
        id: string;
        teamId: string;
        projectId: string;
        snapshotHash: string;
        decisions: unknown;
      } | null;
    };
  }>;
}

export interface RepositoryIntakeSummary {
  projectType: string | null;
  architecture: string | null;
  componentCount: number | null;
}
