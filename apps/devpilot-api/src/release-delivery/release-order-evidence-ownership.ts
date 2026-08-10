import type { ReleaseOrderEvidenceRepository } from "./release-order-evidence.repository";

export type ReleaseOrderEvidenceRecord = NonNullable<
  Awaited<ReturnType<ReleaseOrderEvidenceRepository["find"]>>
>;
export type EvidenceBuildRow = ReleaseOrderEvidenceRecord["buildRuns"][number];
export type EvidenceDeploymentRow =
  ReleaseOrderEvidenceRecord["stagingRuns"][number];
export type EvidenceProductionRow =
  ReleaseOrderEvidenceRecord["productionRuns"][number];

export function ownsEvidenceManifest(
  input: ReleaseOrderEvidenceRecord,
  manifest: EvidenceBuildRow["manifest"],
  buildRunId: string,
) {
  return manifest &&
    manifest.teamId === input.order.teamId &&
    manifest.projectId === input.order.projectId &&
    manifest.releaseOrderId === input.order.id &&
    manifest.buildRunId === buildRunId &&
    manifest.buildRun.id === buildRunId
    ? manifest
    : null;
}

export function ownsProductionDeployment(
  input: ReleaseOrderEvidenceRecord,
  run: EvidenceProductionRow,
  deployment: EvidenceProductionRow["deploymentRuns"][number],
) {
  return (
    deployment.teamId === input.order.teamId &&
    deployment.projectId === input.order.projectId &&
    deployment.releaseRunId === run.id &&
    deployment.environmentId === run.environmentId &&
    deployment.artifactManifestId === run.artifactManifestId
  );
}
