interface BuildRecord {
  id: string;
  releaseOrderId: string;
  revision: number;
  sourceBranch: string;
  sourceCommitSha: string;
  status: string;
  inputHash: string;
  logReference: string | null;
  logSummary: unknown;
  gateSummary: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  manifest: unknown;
  repositoryIdentity: { provider: string; canonicalUrl: string } | null;
  repositoryIdentityRevision: {
    id: string;
    revision: number;
    defaultBranch: string;
  } | null;
}

export function presentBuild(run: BuildRecord) {
  return {
    id: run.id,
    releaseOrderId: run.releaseOrderId,
    revision: run.revision,
    sourceBranch: run.sourceBranch,
    sourceCommitSha: run.sourceCommitSha,
    sourceRepository: run.repositoryIdentity && run.repositoryIdentityRevision ? {
      provider: run.repositoryIdentity.provider,
      canonicalUrl: run.repositoryIdentity.canonicalUrl,
      identityRevisionId: run.repositoryIdentityRevision.id,
      identityRevision: run.repositoryIdentityRevision.revision,
      branch: run.repositoryIdentityRevision.defaultBranch,
    } : null,
    status: run.status,
    inputHash: run.inputHash,
    logReference: run.logReference,
    logSummary: run.logSummary,
    gateSummary: run.gateSummary,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    createdAt: run.createdAt,
    manifest: run.manifest,
  };
}
