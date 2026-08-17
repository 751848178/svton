import type {
  RepositoryAnalysisResult,
  RepositorySuggestionDraft,
} from "./repository-parser.types";

export interface RepositoryCompletionAudit {
  teamId: string;
  userId?: string | null;
  projectId: string;
  action: "repository.analysis.succeed" | "repository.analysis.fail" | "repository.analysis.cancel";
  status?: "completed" | "failed";
  summary: string;
  metadata: Record<string, unknown>;
}

export interface RepositorySuccessCompletion {
  runId: string;
  workerLeaseToken: string;
  result: RepositoryAnalysisResult;
  drafts: RepositorySuggestionDraft[];
  audit: RepositoryCompletionAudit;
}

export interface RepositoryFailureCompletion {
  runId: string;
  workerLeaseToken: string;
  currentStage: string;
  status: "failed" | "cancelled";
  detail: { code: string; message: string; action: string };
  audit: RepositoryCompletionAudit;
}
