import { Prisma } from "@prisma/client";

export function governedProductionDeploymentExists() {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM ReleaseRun drr
    INNER JOIN OperationApproval doa
      ON doa.id = drr.operationApprovalId
      AND doa.teamId = drr.teamId AND doa.projectId = drr.projectId
      AND doa.environmentId = drr.environmentId
      AND doa.category = 'release'
      AND doa.action = 'project.release_order.deploy_production'
      AND doa.targetType = 'release_run' AND doa.targetId = drr.id
      AND doa.inputHash = drr.inputHash
      AND doa.status = 'approved' AND doa.reviewedAt IS NOT NULL
    WHERE drr.id = dr.releaseRunId
      AND drr.status IN ('running', 'succeeded')
      AND drr.releaseOrderId = am.releaseOrderId
      AND drr.artifactManifestId = dr.artifactManifestId
      AND drr.environmentId = dr.environmentId
      AND drr.teamId = dr.teamId AND drr.projectId = dr.projectId
      AND drr.verifiedDigest = am.digest
  )`;
}

export function succeededProductionDeploymentExists() {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM ReleaseRun drr
    INNER JOIN OperationApproval doa
      ON doa.id = drr.operationApprovalId
      AND doa.teamId = drr.teamId AND doa.projectId = drr.projectId
      AND doa.environmentId = drr.environmentId
      AND doa.category = 'release'
      AND doa.action = 'project.release_order.deploy_production'
      AND doa.targetType = 'release_run' AND doa.targetId = drr.id
      AND doa.inputHash = drr.inputHash
      AND doa.status = 'approved' AND doa.reviewedAt IS NOT NULL
    WHERE drr.id = dr.releaseRunId
      AND drr.releaseOrderId = am.releaseOrderId
      AND drr.artifactManifestId = dr.artifactManifestId
      AND drr.environmentId = dr.environmentId
      AND drr.teamId = dr.teamId AND drr.projectId = dr.projectId
      AND drr.verifiedDigest = am.digest AND drr.status = 'succeeded'
  )`;
}

export function releaseRunCompletionEvidenceExists() {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM DeploymentRun pdr
    INNER JOIN ProjectEnvironment ppe
      ON ppe.id = pdr.environmentId
      AND ppe.teamId = pdr.teamId AND ppe.projectId = pdr.projectId
      AND ppe.status = 'active' AND ppe.baselineRole = 'production'
    INNER JOIN OperationApproval poa
      ON poa.id = rr.operationApprovalId
      AND poa.teamId = rr.teamId AND poa.projectId = rr.projectId
      AND poa.environmentId = rr.environmentId
      AND poa.category = 'release'
      AND poa.action = 'project.release_order.deploy_production'
      AND poa.targetType = 'release_run' AND poa.targetId = rr.id
      AND poa.inputHash = rr.inputHash
      AND poa.status = 'approved' AND poa.reviewedAt IS NOT NULL
    WHERE pdr.releaseRunId = rr.id
      AND pdr.artifactManifestId = rr.artifactManifestId
      AND pdr.environmentId = rr.environmentId
      AND pdr.teamId = rr.teamId AND pdr.projectId = rr.projectId
      AND pdr.source = 'release_order' AND pdr.dryRun = FALSE
      AND pdr.status = 'completed'
  )`;
}
