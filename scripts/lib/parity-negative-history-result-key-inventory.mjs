const keys = (value) => Object.freeze(value.split(" ").sort());

export const HISTORY_RESULT_KEY_INVENTORY = Object.freeze({
  login: keys("email source status verified"),
  "base-state-rows": keys(
    "buildRuns environments expected manifests productionVersions stagingVersions",
  ),
  "build-2": keys(
    "buildRunId dbBuildRuns dbManifests digestDeterministic distinctFromB1 firstManifestDigest logSummary manifestDigest manifestDistinctFromM1 manifestId pinned sourceCommitSha status",
  ),
  "staging-deploy-repeat": keys(
    "artifactVerified buildRunCount buildRunCountUnchanged commandEvidence completedRunsOnM1 deploymentRunId distinctFromD1st expectedManifestId firstDeploymentRunId newStagingCurrent sameManifestM1 stagingDeploymentRunsOnM1 stagingDeploymentRunsOnOrder status",
  ),
  "staging-upgrade": keys(
    "artifactVerified currentMoved deploymentRunId environmentId expectedEnvironmentId expectedManifestId expectedPreviousVersionId manifestId newEnvironmentVersion status",
  ),
  "staging-recovery": keys(
    "artifactVerified currentMoved deploymentRunId environmentId expectedEnvironmentId expectedManifestId expectedPreviousVersionId manifestId newEnvironmentVersion restoredManifest sourceVersionId status",
  ),
  "production-preview": keys(
    "expectedManifestDigest inputHash manifestDigest manifestFrozen snapshot",
  ),
  "production-confirm": keys(
    "approvalAction approvalId approvalStatus awaitingApproval expectedInputHash expectedManifestDigest expectedManifestId manifestId mode releaseRunId status verifiedDigest verifiedDigestMatches",
  ),
  "production-approve": keys(
    "approvalId decision reviewedAt reviewerId status",
  ),
  "production-upgrade-execute": keys(
    "artifactVerified currentMoved deploymentRunId environmentId expectedEnvironmentId expectedManifestId expectedPreviousVersionId expectedReleaseRunId gateDecision healthProbe manifestId newEnvironmentVersion productionGate releaseRun releaseRunId routeEvidence routeSwitch siteProbe status workload",
  ),
  "production-recovery-preview": keys(
    "expectedManifestDigest expectedManifestId expectedSourceVersionId inputHash snapshot sourceManifestDigest sourceManifestId sourceReleaseRunId sourceVersionId sourceVersionKind",
  ),
  "production-recovery-confirm": keys(
    "approvalAction approvalId approvalStatus awaitingApproval expectedInputHash expectedManifestDigest expectedManifestId manifestId mode recoveryReleaseRunId releaseRunId sourceReleaseRunId sourceVersionId status verifiedDigest verifiedDigestMatches",
  ),
  "production-recovery-approve": keys(
    "approvalId decision reviewedAt reviewerId status",
  ),
  "production-recovery-execute": keys(
    "artifactVerified currentMoved deploymentRunId environmentId expectedEnvironmentId expectedManifestId expectedPreviousVersionId expectedReleaseRunId gateDecision healthProbe manifestId newEnvironmentVersion productionGate releaseRun releaseRunId restoredM1 routeEvidence routeSwitch siteProbe status workload",
  ),
  "version-chains": keys(
    "expectedReleaseRuns production productionRecoverySourcePresent releaseRuns staging stagingRecoverySourcePresent",
  ),
  "browser-pass": keys(
    "artifacts badResponses buildLogDrawer cdpSchema cdpSessionIdentity cdpVersion consoleErrors consoleEvents driver driverExit envVersionsEvidence failedRequests httpResponses log productionRunLog releaseDetailEvidence requiredArtifacts runtimeExceptions stagingRunLog stagingStepEvidence viewport",
  ),
});
