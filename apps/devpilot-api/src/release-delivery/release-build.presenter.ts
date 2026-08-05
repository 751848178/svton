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
  inputSnapshot: unknown;
  repositoryIdentity: { provider: string; canonicalUrl: string } | null;
  repositoryIdentityRevision: {
    id: string;
    revision: number;
    defaultBranch: string;
  } | null;
}

export function presentBuild(run: BuildRecord) {
  const snapshot = readKnownSnapshot(run.inputSnapshot);
  const legacyFallback =
    run.inputSnapshot === null ||
    (isRecord(run.inputSnapshot) && run.inputSnapshot.version === 1);
  const sourceRepository = snapshot
    ? {
        provider: snapshot.provider,
        canonicalUrl: snapshot.canonicalUrl,
        identityRevisionId: snapshot.revisionId,
        identityRevision: snapshot.revision,
        branch: snapshot.branch,
      }
    : legacyFallback
      ? legacySourceRepository(run)
      : null;
  return {
    id: run.id,
    releaseOrderId: run.releaseOrderId,
    revision: run.revision,
    sourceBranch: snapshot?.branch ?? run.sourceBranch,
    sourceCommitSha: snapshot?.commitSha ?? run.sourceCommitSha,
    sourceRepository,
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

function legacySourceRepository(run: BuildRecord) {
  if (!run.repositoryIdentity || !run.repositoryIdentityRevision) return null;
  return {
    provider: run.repositoryIdentity.provider,
    canonicalUrl: run.repositoryIdentity.canonicalUrl,
    identityRevisionId: run.repositoryIdentityRevision.id,
    identityRevision: run.repositoryIdentityRevision.revision,
    branch: run.repositoryIdentityRevision.defaultBranch,
  };
}

function readKnownSnapshot(value: unknown) {
  if (
    !isRecord(value) ||
    (value.version !== 2 && value.version !== 3 && value.version !== 4) ||
    !isRecord(value.repositoryIdentity)
  )
    return null;
  const identity = value.repositoryIdentity;
  if (
    !isString(identity.provider) ||
    !isString(identity.canonicalUrl) ||
    !isString(identity.revisionId) ||
    !Number.isInteger(identity.revision) ||
    Number(identity.revision) < 1 ||
    !isString(value.sourceBranch) ||
    !isString(value.sourceCommitSha) ||
    !/^[0-9a-f]{40}([0-9a-f]{24})?$/i.test(value.sourceCommitSha)
  )
    return null;
  return {
    provider: identity.provider,
    canonicalUrl: identity.canonicalUrl,
    revisionId: identity.revisionId,
    revision: Number(identity.revision),
    branch: value.sourceBranch,
    commitSha: value.sourceCommitSha,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
