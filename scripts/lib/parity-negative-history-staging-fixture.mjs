export function historyAnchorFixture(context) {
  return {
    ...context,
    productionReleaseRunId: "release-1",
    buildRunB2: "build-2",
    manifestM2: "manifest-2",
    manifestM2Digest: context.manifestDigest,
    stagingDeploymentRunD2: "staging-deploy-2",
    stagingVersionV2: "staging-v2",
    stagingDeploymentRunD3: "staging-deploy-3",
    stagingVersionV3: "staging-v3",
    stagingDeploymentRunD4: "staging-deploy-4",
    stagingVersionV4: "staging-v4",
    productionReleaseRunR2: "release-2",
    productionApprovalA2: "approval-2",
    productionDeploymentRunD2: "production-deploy-2",
    productionVersionV2: "production-v2",
    productionReleaseRunR3: "release-3",
    productionApprovalA3: "approval-3",
    productionDeploymentRunD3: "production-deploy-3",
    productionVersionV3: "production-v3",
  };
}

export function stagingResultsFixture(anchors) {
  return {
    "build-2": {
      buildRunId: anchors.buildRunB2,
      distinctFromB1: true,
      status: "succeeded",
      sourceCommitSha: anchors.pinnedCommit,
      pinned: true,
      manifestId: anchors.manifestM2,
      manifestDistinctFromM1: true,
      manifestDigest: anchors.manifestM2Digest,
      digestDeterministic: true,
      firstManifestDigest: anchors.manifestDigest,
      logSummary: "second build completed",
      dbBuildRuns: 2,
      dbManifests: 2,
    },
    "staging-deploy-repeat": repeatFixture(anchors),
    "staging-upgrade": versionActionFixture(anchors, "upgrade"),
    "staging-recovery": versionActionFixture(anchors, "recovery"),
  };
}

function repeatFixture(a) {
  return {
    deploymentRunId: a.stagingDeploymentRunD2,
    firstDeploymentRunId: a.stagingDeploymentRunId,
    distinctFromD1st: true,
    status: "completed",
    sameManifestM1: true,
    stagingDeploymentRunsOnM1: [
      a.stagingDeploymentRunId,
      a.stagingDeploymentRunD2,
    ],
    completedRunsOnM1: 2,
    stagingDeploymentRunsOnOrder: [
      { id: a.stagingDeploymentRunId, manifest: a.manifestId },
      { id: a.stagingDeploymentRunD2, manifest: a.manifestId },
    ],
    buildRunCountUnchanged: true,
    buildRunCount: 2,
    newStagingCurrent: {
      id: a.stagingVersionV2,
      kind: "deploy",
      artifactManifestId: a.manifestId,
      previousVersionId: a.stagingCurrentVersionId,
      deploymentRunId: a.stagingDeploymentRunD2,
    },
    expectedManifestId: a.manifestId,
    artifactVerified: true,
    commandEvidence: commandEvidence(a),
  };
}

function commandEvidence(a) {
  return {
    commandPlan: {
      steps: [
        "verify_manifest_digest",
        "materialize_exact_manifest",
        "start_workloads",
        "probe_workloads",
        "activate_release",
      ],
      checkout: false,
      pull: false,
      build: false,
    },
    providerEvidence: {
      checkoutInvoked: false,
      pullInvoked: false,
      buildInvoked: false,
      gitInvoked: false,
    },
    resultManifestId: a.manifestId,
    resultManifestDigest: a.manifestDigest,
    expectedManifestId: a.manifestId,
    expectedManifestDigest: a.manifestDigest,
    paramsManifestId: a.manifestId,
    paramsManifestDigest: a.manifestDigest,
  };
}

function versionActionFixture(a, kind) {
  const recovery = kind === "recovery";
  const deploymentRunId = recovery
    ? a.stagingDeploymentRunD4
    : a.stagingDeploymentRunD3;
  const versionId = recovery ? a.stagingVersionV4 : a.stagingVersionV3;
  const manifestId = recovery ? a.manifestId : a.manifestM2;
  const previousVersionId = recovery ? a.stagingVersionV3 : a.stagingVersionV2;
  const result = {
    deploymentRunId,
    status: "completed",
    environmentId: a.stagingEnvId,
    manifestId,
    expectedEnvironmentId: a.stagingEnvId,
    expectedManifestId: manifestId,
    expectedPreviousVersionId: previousVersionId,
    newEnvironmentVersion: {
      id: versionId,
      kind,
      previousVersionId,
      [recovery ? "previousIsVst3" : "previousIsVst2"]: true,
    },
    currentMoved: true,
    artifactVerified: true,
  };
  if (recovery) {
    result.sourceVersionId = a.stagingVersionV2;
    result.restoredManifest = true;
  }
  return result;
}
