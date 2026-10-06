import type { EvidenceProductionRow } from "./release-order-evidence-ownership";

export function presentReleaseStagingProof(
  proof: EvidenceProductionRow["stagingProof"],
) {
  return {
    deploymentRunId: proof.id,
    environmentId: proof.environmentId,
    artifactManifestId: proof.artifactManifestId,
    status: proof.status,
    dryRun: proof.dryRun,
    result: proof.result,
    finishedAt: proof.finishedAt,
  };
}
