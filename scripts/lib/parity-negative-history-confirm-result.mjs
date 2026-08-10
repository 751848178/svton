// Producer-only projection: builds the standard/recovery production confirm
// result object recorded in history evidence from the API response plus the
// exact locally supplied request variables. The expectedInputHash and the
// recovery sourceVersionId always come from the producer's own request
// variables, never from a response-owned hash. No validation lives here.
//
// Imported only by the F456 history producer; consumers validate the shape.
export function productionConfirmResult(response, mode, request) {
  const releaseRunId = response.id;
  const result = {
    releaseRunId,
    status: response.status,
    awaitingApproval: response.status === "awaiting_approval",
    mode,
    approvalId: response.operationApproval?.id,
    approvalStatus: response.operationApproval?.status,
    approvalAction: response.operationApproval?.action,
    manifestId: response.artifactManifestId,
    expectedManifestId: request.expectedManifestId,
    verifiedDigest: response.verifiedDigest,
    expectedManifestDigest: request.expectedManifestDigest,
    verifiedDigestMatches:
      response.verifiedDigest === request.expectedManifestDigest,
    expectedInputHash: request.expectedInputHash,
  };
  if (mode === "recovery") {
    result.recoveryReleaseRunId = releaseRunId;
    result.sourceReleaseRunId = response.sourceReleaseRunId;
    result.sourceVersionId = request.sourceVersionId;
  }
  return result;
}
