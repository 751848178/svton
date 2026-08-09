export function cleanupReceiptFor(runtime, residualResources) {
  return {
    status: "verified_zero_residuals",
    verifiedAt: new Date().toISOString(),
    runtimeId: runtime.runtimeId,
    goalId: runtime.goalId,
    cleanupOwnerToken: runtime.cleanupOwnerToken,
    residualResources,
  };
}

export function publicRuntime(runtime) {
  return {
    composeProject: runtime.composeProject,
    databaseName: runtime.databaseName,
    ports: runtime.ports,
    apiImage: runtime.apiImage,
    webImage: runtime.webImage,
    routeControlImage: runtime.routeControlImage,
    apiBase: runtime.apiBase,
    webOrigin: runtime.webOrigin,
    targetOrigin: runtime.targetOrigin,
    routeControlOrigin: runtime.routeControlOrigin,
    sourceRevision: runtime.sourceRevision,
    sourceTreeSha256: runtime.sourceTreeSha256,
    runtimeId: runtime.runtimeId,
    goalId: runtime.goalId,
  };
}
