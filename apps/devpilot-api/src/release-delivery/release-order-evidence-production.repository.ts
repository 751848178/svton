import { Prisma } from "@prisma/client";
import {
  exactProductionProof,
  type EvidenceScope,
  productionEvidenceIndexSelect,
  productionEvidenceProofSelect,
  productionProofId,
} from "./release-order-evidence-production-ownership";
import {
  releaseEvidenceDeploymentSelect,
  releaseEvidenceEnvironmentSelect,
  releaseEvidenceManifestSelect,
} from "./release-order-evidence.prisma";

export async function loadProductionEvidence(
  tx: Prisma.TransactionClient,
  scope: EvidenceScope,
  take: number,
) {
  const where = productionWhere(scope);
  const candidates = await tx.releaseRun.findMany({
    where,
    select: productionEvidenceIndexSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const proofIds = [
    ...new Set(candidates.map(productionProofId).filter(Boolean)),
  ];
  const proofs = await tx.deploymentRun.findMany({
    where: { id: { in: proofIds } },
    select: productionEvidenceProofSelect,
  });
  const proofById = new Map(proofs.map((proof) => [proof.id, proof]));
  const eligible = candidates.filter((run) =>
    exactProductionProof(run, proofById, scope),
  );
  const selectedIds = eligible.slice(0, take).map((run) => run.id);
  const rows = await tx.releaseRun.findMany({
    where: { ...where, id: { in: selectedIds } },
    select: {
      id: true,
      teamId: true,
      projectId: true,
      releaseOrderId: true,
      environmentId: true,
      artifactManifestId: true,
      status: true,
      verifiedDigest: true,
      inputHash: true,
      errorCode: true,
      errorMessage: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      environment: { select: releaseEvidenceEnvironmentSelect },
      artifactManifest: { select: releaseEvidenceManifestSelect },
      operationApproval: {
        select: {
          id: true,
          teamId: true,
          projectId: true,
          environmentId: true,
          category: true,
          action: true,
          targetType: true,
          targetId: true,
          status: true,
          inputHash: true,
          metadata: true,
          requestedAt: true,
          reviewedAt: true,
        },
      },
      deploymentRuns: {
        where: {
          teamId: scope.teamId,
          projectId: scope.projectId,
          source: "release_order",
          dryRun: false,
          projectEnvironment: {
            teamId: scope.teamId,
            projectId: scope.projectId,
            baselineRole: "production",
          },
        },
        select: releaseEvidenceDeploymentSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return {
    productionRuns: rows.map((run) => {
      const stagingProof = proofById.get(productionProofId(run));
      if (!stagingProof) throw new Error("Production staging proof missing");
      return { ...run, stagingProof };
    }),
    productionTotal: eligible.length,
  };
}

function productionWhere(scope: EvidenceScope) {
  return {
    ...scope,
    environment: {
      teamId: scope.teamId,
      projectId: scope.projectId,
      baselineRole: "production",
    },
    artifactManifest: {
      teamId: scope.teamId,
      projectId: scope.projectId,
      releaseOrderId: scope.releaseOrderId,
      buildRun: {
        teamId: scope.teamId,
        projectId: scope.projectId,
        releaseOrderId: scope.releaseOrderId,
        status: "succeeded",
      },
    },
  } as const;
}
