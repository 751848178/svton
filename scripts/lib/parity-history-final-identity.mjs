const FINAL_STEP = "production-recovery-execute";

export function finalProductionIdentityFromHistory(document) {
  const step = document?.steps?.[FINAL_STEP];
  const result = step?.result;
  if (
    document?.status !== "passed" ||
    step?.status !== "passed" ||
    step?.verified !== true ||
    result?.status !== "completed" ||
    result?.newEnvironmentVersion?.kind !== "recovery" ||
    result?.newEnvironmentVersion?.deploymentRunId !== result?.deploymentRunId
  ) {
    throw historyIdentityError("final-step");
  }
  const identity = {
    teamId: requireId(document.context?.teamId, "team"),
    projectId: requireId(document.context?.projectId, "project"),
    environmentId: requireId(
      document.context?.productionEnvId,
      "production-environment",
    ),
    releaseRunId: requireId(result.releaseRunId, "release-run"),
    deploymentRunId: requireId(result.deploymentRunId, "deployment-run"),
    environmentVersionId: requireId(
      result.newEnvironmentVersion.id,
      "environment-version",
    ),
  };
  if (result.expectedReleaseRunId !== identity.releaseRunId) {
    throw historyIdentityError("expected-release-run");
  }
  if (
    result.environmentId !== identity.environmentId ||
    result.expectedEnvironmentId !== identity.environmentId
  ) {
    throw historyIdentityError("expected-environment");
  }
  return Object.freeze(identity);
}

function requireId(value, reason) {
  if (typeof value !== "string" || value.length < 3 || value.length > 191) {
    throw historyIdentityError(reason);
  }
  return value;
}

function historyIdentityError(reason) {
  return new Error(`F537_HISTORY_FINAL_IDENTITY_INVALID: ${reason}`);
}
