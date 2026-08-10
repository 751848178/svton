export function identityFixtures() {
  const digest = `sha256:${"a".repeat(64)}`;
  const staging = (kind) => ({
    deploymentRunId: "deploy",
    status: "completed",
    environmentId: "environment",
    expectedEnvironmentId: "environment",
    manifestId: "manifest",
    expectedManifestId: "manifest",
    newEnvironmentVersion: {
      id: "version",
      kind,
      previousVersionId: "previous",
    },
    expectedPreviousVersionId: "previous",
    currentMoved: true,
    artifactVerified: true,
  });
  const confirm = (mode, approvalAction) => ({
    releaseRunId: "release",
    status: "awaiting_approval",
    mode,
    approvalId: "approval",
    approvalStatus: "pending",
    approvalAction,
    manifestId: "manifest",
    expectedManifestId: "manifest",
    verifiedDigest: digest,
    expectedManifestDigest: digest,
  });
  const stagingPairs = [
    ["environmentId", "expectedEnvironmentId"],
    ["manifestId", "expectedManifestId"],
    ["newEnvironmentVersion.previousVersionId", "expectedPreviousVersionId"],
  ];
  const confirmPairs = [
    ["manifestId", "expectedManifestId"],
    ["verifiedDigest", "expectedManifestDigest"],
  ];
  return [
    {
      step: "staging-upgrade",
      result: staging("upgrade"),
      pairs: stagingPairs,
    },
    {
      step: "staging-recovery",
      result: staging("recovery"),
      pairs: stagingPairs,
    },
    {
      step: "production-preview",
      result: {
        inputHash: "b".repeat(64),
        manifestFrozen: true,
        manifestDigest: digest,
        expectedManifestDigest: digest,
      },
      pairs: [["manifestDigest", "expectedManifestDigest"]],
    },
    {
      step: "production-confirm",
      result: confirm("standard", "project.release_order.deploy_production"),
      pairs: confirmPairs,
    },
    {
      step: "production-recovery-preview",
      result: {
        inputHash: "c".repeat(64),
        sourceVersionId: "version",
        expectedSourceVersionId: "version",
        sourceManifestId: "manifest",
        expectedManifestId: "manifest",
        sourceManifestDigest: digest,
        expectedManifestDigest: digest,
      },
      pairs: [
        ["sourceVersionId", "expectedSourceVersionId"],
        ["sourceManifestId", "expectedManifestId"],
        ["sourceManifestDigest", "expectedManifestDigest"],
      ],
    },
    {
      step: "production-recovery-confirm",
      result: confirm(
        "recovery",
        "project.release_order.deploy_production_recovery",
      ),
      pairs: confirmPairs,
    },
  ];
}

export function deletePath(value, path) {
  const parts = path.split(".");
  const key = parts.pop();
  const parent = parts.reduce((current, part) => current?.[part], value);
  if (parent) delete parent[key];
}
