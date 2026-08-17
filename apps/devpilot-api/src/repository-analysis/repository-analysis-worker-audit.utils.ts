import type {
  RepositoryFailureCompletion,
  RepositorySuccessCompletion,
} from "./repository-analysis-completion.types";

export interface RepositoryWorkerRunIdentity {
  id: string;
  teamId: string;
  projectId: string;
  triggeredById?: string | null;
  branch: string;
  commitSha: string;
  parserVersion: string;
}

export function repositorySuccessAudit(
  run: RepositoryWorkerRunIdentity,
  services: number,
  suggestions: number,
): RepositorySuccessCompletion["audit"] {
  return {
    teamId: run.teamId,
    userId: run.triggeredById,
    projectId: run.projectId,
    action: "repository.analysis.succeed",
    summary: `仓库解析完成：${services} 个单元，${suggestions} 条建议`,
    metadata: {
      runId: run.id,
      branch: run.branch,
      commitSha: run.commitSha,
      parserVersion: run.parserVersion,
    },
  };
}

export function repositoryFailureAudit(
  run: RepositoryWorkerRunIdentity,
  cancelled: boolean,
  detail: { code: string; message: string },
  stage: string,
): RepositoryFailureCompletion["audit"] {
  return {
    teamId: run.teamId,
    userId: run.triggeredById,
    projectId: run.projectId,
    action: cancelled ? "repository.analysis.cancel" : "repository.analysis.fail",
    status: cancelled ? "completed" : "failed",
    summary: detail.message,
    metadata: { runId: run.id, errorCode: detail.code, stage },
  };
}
