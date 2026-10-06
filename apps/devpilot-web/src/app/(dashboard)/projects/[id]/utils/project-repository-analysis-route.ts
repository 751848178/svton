export function repositoryAnalysisPageHref(projectId: string, runId?: string) {
  const base = `/projects/${encodeURIComponent(projectId)}/repository-analysis`;
  return runId ? `${base}?analysisRunId=${encodeURIComponent(runId)}` : base;
}

export function legacyRepositoryAnalysisRunHref(projectId: string, searchParams: URLSearchParams) {
  const runId = searchParams.get('analysisRunId')?.trim();
  return runId ? repositoryAnalysisPageHref(projectId, runId) : null;
}
