import { presentBuildErrorMessage } from "./release-build.presenter";

interface BuildHistoryRecord {
  id: string;
  releaseOrderId: string;
  revision: number;
  sourceBranch: string;
  sourceCommitSha: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  manifest: { id: string; digest: string } | null;
}

export function presentBuildHistory(run: BuildHistoryRecord) {
  return {
    ...run,
    sourceRepository: null,
    logReference: null,
    logSummary: null,
    gateSummary: null,
    errorMessage: presentBuildErrorMessage(run.errorMessage),
    manifest: run.manifest ? { ...run.manifest, items: [] } : null,
  };
}
