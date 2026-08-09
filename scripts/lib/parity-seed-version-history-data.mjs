export function parityHistoryDeploymentData(ids, scope, record, role) {
  return {
    ...scope,
    actorId: ids.user,
    environmentId: role === "staging" ? ids.envStaging : ids.envProduction,
    artifactManifestId: record.manifestId,
    environment: role,
    mode: "deploy",
    source: "release_order",
    trigger: "api",
    targetType: "server",
    executorKey: "parity-fixture",
    adapterKey: "parity-copy",
    dryRun: false,
    status: "completed",
    branch: "main",
    commitSha: record.pinnedCommit,
    params: { version: 1, manifestId: record.manifestId },
    result: {
      artifactVerified: true,
      manifestId: record.manifestId,
      manifestDigest: record.digest,
      providerKey: "local-filesystem-v1",
    },
    startedAt: record.effectiveAt,
    finishedAt: record.effectiveAt,
  };
}

export function parityHistoryVersionData(ids, scope, record, relationships) {
  return {
    ...scope,
    releaseOrderId: ids.orderPrev,
    artifactManifestId: record.manifestId,
    kind: record.kind,
    effectiveAt: record.effectiveAt,
    releaseRunId: null,
    ...relationships,
  };
}

export function parityHistoryApprovalData(ids, scope, record) {
  return {
    ...scope,
    requesterId: ids.user,
    reviewerId: ids.user,
    environmentId: ids.envProduction,
    category: "release",
    action: "project.release_order.deploy_production",
    targetType: "release_run",
    targetId: record.releaseRunId,
    risk: "high",
    status: "approved",
    inputHash: record.inputHash,
    reviewComment: "Parity historical production approval",
    metadata: {
      snapshot: {
        version: 2,
        projectId: ids.project,
        releaseOrder: { id: ids.orderPrev },
        build: { id: record.buildId },
        manifest: { id: record.manifestId, digest: record.digest },
        environment: { id: ids.envProduction },
        stagingProof: {
          deploymentRunId: record.stagingDeploymentId,
          environmentId: ids.envStaging,
          finishedAt: record.effectiveAt.toISOString(),
        },
      },
    },
    requestedAt: record.effectiveAt,
    reviewedAt: record.effectiveAt,
    consumedAt: record.effectiveAt,
  };
}

export function parityHistoryPolicySnapshot() {
  return {
    version: 2,
    revision: 0,
    strategy: "standard",
    requireProductionApproval: true,
    synthetic: true,
    snapshotHash: "default-standard-policy-v1",
  };
}
