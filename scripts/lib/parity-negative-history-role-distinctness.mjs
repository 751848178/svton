import { requireDistinct } from "./parity-negative-history-identity-assert.mjs";

export const GENERATED_ROLE_MODEL_GROUPS = Object.freeze({
  BuildRun: ["buildRunId", "buildRunB2"],
  ArtifactManifest: ["manifestId", "manifestM2"],
  DeploymentRun: [
    "stagingDeploymentRunId",
    "stagingDeploymentRunD2",
    "stagingDeploymentRunD3",
    "stagingDeploymentRunD4",
    "productionDeploymentRunD2",
    "productionDeploymentRunD3",
  ],
  EnvironmentVersion: [
    "stagingCurrentVersionId",
    "stagingVersionV2",
    "stagingVersionV3",
    "stagingVersionV4",
    "productionCurrentVersionId",
    "productionVersionV2",
    "productionVersionV3",
  ],
  ReleaseRun: [
    "productionReleaseRunId",
    "productionReleaseRunR2",
    "productionReleaseRunR3",
  ],
  OperationApproval: ["productionApprovalA2", "productionApprovalA3"],
});

export function validateGeneratedRoleDistinctness(anchors) {
  for (const [model, fields] of Object.entries(GENERATED_ROLE_MODEL_GROUPS)) {
    requireDistinct(
      fields.map((field) => anchors[field]),
      `graph:${model}`,
    );
  }
}
