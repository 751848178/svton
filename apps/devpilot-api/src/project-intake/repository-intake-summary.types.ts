export interface RepositoryIntakeSummarySource {
  config: unknown;
  repositoryIntakeReviewSnapshots: Array<{
    decisions: unknown;
  }>;
}

export interface RepositoryIntakeSummary {
  projectType: string | null;
  architecture: string | null;
  componentCount: number | null;
}
