export interface CreateRepositoryRunInput {
  teamId: string;
  projectId: string;
  connectionId: string;
  triggeredById: string;
  retryOfId?: string;
  repositoryUrl: string;
  branch: string;
  commitSha: string;
  idempotencyKey: string;
  parserVersion: string;
}

export const REPOSITORY_ANALYSIS_RUN_INCLUDE = {
  stages: { orderBy: { ordinal: 'asc' as const } },
  suggestions: { orderBy: { createdAt: 'asc' as const } },
};
