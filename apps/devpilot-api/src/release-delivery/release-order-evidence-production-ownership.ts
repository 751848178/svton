import { Prisma } from "@prisma/client";
import { releaseEvidenceEnvironmentSelect } from "./release-order-evidence.prisma";

export const productionEvidenceIndexSelect = {
  id: true,
  teamId: true,
  projectId: true,
  releaseOrderId: true,
  environmentId: true,
  artifactManifestId: true,
  verifiedDigest: true,
  inputHash: true,
  createdAt: true,
  environment: { select: releaseEvidenceEnvironmentSelect },
  artifactManifest: {
    select: {
      id: true,
      teamId: true,
      projectId: true,
      releaseOrderId: true,
      digest: true,
      buildRun: {
        select: {
          id: true,
          teamId: true,
          projectId: true,
          releaseOrderId: true,
          status: true,
        },
      },
    },
  },
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
      inputHash: true,
      metadata: true,
    },
  },
} as const;

export const productionEvidenceProofSelect = {
  id: true,
  teamId: true,
  projectId: true,
  environmentId: true,
  artifactManifestId: true,
  source: true,
  status: true,
  dryRun: true,
  result: true,
  finishedAt: true,
  projectEnvironment: { select: releaseEvidenceEnvironmentSelect },
} as const;

export type ProductionEvidenceIndexRow = Prisma.ReleaseRunGetPayload<{
  select: typeof productionEvidenceIndexSelect;
}>;
export type ProductionEvidenceProofRow = Prisma.DeploymentRunGetPayload<{
  select: typeof productionEvidenceProofSelect;
}>;

export interface EvidenceScope {
  teamId: string;
  projectId: string;
  releaseOrderId: string;
}

export function exactProductionProof(
  run: ProductionEvidenceIndexRow,
  proofs: Map<string, ProductionEvidenceProofRow>,
  scope: EvidenceScope,
) {
  const approval = run.operationApproval;
  const snapshot = record(record(approval?.metadata).snapshot);
  const releaseOrder = record(snapshot.releaseOrder);
  const build = record(snapshot.build);
  const manifest = record(snapshot.manifest);
  const environment = record(snapshot.environment);
  const proofRef = record(snapshot.stagingProof);
  const proof = proofs.get(stringValue(proofRef.deploymentRunId));
  const proofResult = record(proof?.result);
  const manifestRow = run.artifactManifest;
  const buildRow = manifestRow.buildRun;
  const owns =
    run.teamId === scope.teamId &&
    run.projectId === scope.projectId &&
    run.releaseOrderId === scope.releaseOrderId &&
    run.environment.teamId === scope.teamId &&
    run.environment.projectId === scope.projectId &&
    run.environment.baselineRole === "production" &&
    manifestRow.teamId === scope.teamId &&
    manifestRow.projectId === scope.projectId &&
    manifestRow.releaseOrderId === scope.releaseOrderId &&
    buildRow.teamId === scope.teamId &&
    buildRow.projectId === scope.projectId &&
    buildRow.releaseOrderId === scope.releaseOrderId &&
    buildRow.status === "succeeded" &&
    run.verifiedDigest === manifestRow.digest &&
    approval?.teamId === scope.teamId &&
    approval.projectId === scope.projectId &&
    approval.environmentId === run.environmentId &&
    approval.category === "release" &&
    (approval.action === "project.release_order.deploy_production" ||
      approval.action === "project.release_order.deploy_production_recovery") &&
    approval.targetType === "release_run" &&
    approval.targetId === run.id &&
    approval.inputHash === run.inputHash &&
    snapshot.version === 2 &&
    snapshot.projectId === scope.projectId &&
    releaseOrder.id === scope.releaseOrderId &&
    build.id === buildRow.id &&
    manifest.id === run.artifactManifestId &&
    manifest.digest === run.verifiedDigest &&
    environment.id === run.environmentId &&
    proof?.teamId === scope.teamId &&
    proof.projectId === scope.projectId &&
    proof.environmentId === proofRef.environmentId &&
    proof.artifactManifestId === run.artifactManifestId &&
    proof.source === "release_order" &&
    proof.status === "completed" &&
    proof.dryRun === false &&
    proof.projectEnvironment?.id === proof.environmentId &&
    proof.projectEnvironment.teamId === scope.teamId &&
    proof.projectEnvironment.projectId === scope.projectId &&
    proof.projectEnvironment?.baselineRole === "staging" &&
    proof.finishedAt?.toISOString() === proofRef.finishedAt &&
    proofResult.artifactVerified === true &&
    proofResult.manifestId === run.artifactManifestId &&
    proofResult.manifestDigest === run.verifiedDigest;
  return owns && proof ? proof : null;
}

export function productionProofId(run: ProductionEvidenceIndexRow) {
  const snapshot = record(record(run.operationApproval?.metadata).snapshot);
  return stringValue(record(snapshot.stagingProof).deploymentRunId);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}
