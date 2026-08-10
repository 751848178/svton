import {
  freezeIdentity,
  historyResult,
  nonEmpty,
  requireDistinct,
  requireEqual,
  requireIdentity,
  validDigest,
} from "./parity-negative-history-identity-assert.mjs";
import { validateStagingVersionAction } from "./parity-negative-history-staging-version-identity.mjs";

export function validateStagingIdentity(steps, base) {
  const build = historyResult(steps, "build-2");
  requireIdentity(nonEmpty(build.buildRunId), "build-2:id");
  requireIdentity(build.buildRunId !== base.buildRunId, "build-2:distinct");
  requireEqual(build.status, "succeeded", "build-2:status");
  requireEqual(build.sourceCommitSha, base.pinnedCommit, "build-2:commit");
  requireEqual(build.pinned, true, "build-2:pinned");
  requireIdentity(nonEmpty(build.manifestId), "build-2:manifest");
  requireIdentity(
    build.manifestId !== base.manifestId,
    "build-2:manifest-distinct",
  );
  requireIdentity(validDigest(build.manifestDigest), "build-2:digest");
  requireEqual(
    build.firstManifestDigest,
    base.manifestDigest,
    "build-2:first-digest",
  );
  requireEqual(
    build.digestDeterministic,
    build.manifestDigest === base.manifestDigest,
    "build-2:digest-claim",
  );
  requireEqual(
    [build.dbBuildRuns, build.dbManifests],
    [2, 2],
    "build-2:counts",
  );
  const built = {
    ...base,
    buildRunB2: build.buildRunId,
    manifestM2: build.manifestId,
    manifestM2Digest: build.manifestDigest,
  };
  const repeat = historyResult(steps, "staging-deploy-repeat");
  requireEqual(
    repeat.firstDeploymentRunId,
    base.stagingDeploymentRunId,
    "repeat:D1",
  );
  requireIdentity(nonEmpty(repeat.deploymentRunId), "repeat:D2");
  requireDistinct(
    [base.stagingDeploymentRunId, repeat.deploymentRunId],
    "repeat:deployments",
  );
  requireEqual(repeat.status, "completed", "repeat:status");
  requireEqual(repeat.sameManifestM1, true, "repeat:manifest-claim");
  requireEqual(
    repeat.expectedManifestId,
    base.manifestId,
    "repeat:expected-manifest",
  );
  requireEqual(
    repeat.stagingDeploymentRunsOnM1,
    [base.stagingDeploymentRunId, repeat.deploymentRunId],
    "repeat:runs-on-M1",
  );
  requireEqual(
    repeat.stagingDeploymentRunsOnOrder,
    [base.stagingDeploymentRunId, repeat.deploymentRunId].map((id) => ({
      id,
      manifest: base.manifestId,
    })),
    "repeat:order-runs",
  );
  requireEqual(
    [
      repeat.completedRunsOnM1,
      repeat.buildRunCount,
      repeat.buildRunCountUnchanged,
    ],
    [2, 2, true],
    "repeat:counts",
  );
  const version2 = repeat.newStagingCurrent;
  requireIdentity(nonEmpty(version2?.id), "repeat:version");
  requireEqual(
    {
      kind: version2.kind,
      manifest: version2.artifactManifestId,
      previous: version2.previousVersionId,
      deployment: version2.deploymentRunId,
    },
    {
      kind: "deploy",
      manifest: base.manifestId,
      previous: base.stagingCurrentVersionId,
      deployment: repeat.deploymentRunId,
    },
    "repeat:version-row",
  );
  validateCommandEvidence(repeat.commandEvidence, base);
  const repeated = {
    ...built,
    stagingDeploymentRunD2: repeat.deploymentRunId,
    stagingVersionV2: version2.id,
  };

  const upgraded = validateStagingVersionAction(
    historyResult(steps, "staging-upgrade"),
    repeated,
    "upgrade",
    built.manifestM2,
    repeated.stagingVersionV2,
  );
  const recovered = validateStagingVersionAction(
    historyResult(steps, "staging-recovery"),
    upgraded,
    "recovery",
    base.manifestId,
    upgraded.stagingVersionV3,
  );
  requireEqual(
    historyResult(steps, "staging-recovery").sourceVersionId,
    repeated.stagingVersionV2,
    "recovery:source",
  );
  requireDistinct(
    [
      base.stagingDeploymentRunId,
      repeated.stagingDeploymentRunD2,
      upgraded.stagingDeploymentRunD3,
      recovered.stagingDeploymentRunD4,
    ],
    "staging:deployment-ids",
  );
  requireDistinct(
    [
      base.stagingCurrentVersionId,
      repeated.stagingVersionV2,
      upgraded.stagingVersionV3,
      recovered.stagingVersionV4,
    ],
    "staging:version-ids",
  );
  return freezeIdentity(recovered);
}

function validateCommandEvidence(command, base) {
  requireIdentity(command && typeof command === "object", "repeat:command");
  requireEqual(
    [
      command.resultManifestId,
      command.expectedManifestId,
      command.paramsManifestId,
    ],
    [base.manifestId, base.manifestId, base.manifestId],
    "repeat:command-manifest",
  );
  requireEqual(
    [
      command.resultManifestDigest,
      command.expectedManifestDigest,
      command.paramsManifestDigest,
    ],
    [base.manifestDigest, base.manifestDigest, base.manifestDigest],
    "repeat:command-digest",
  );
}
