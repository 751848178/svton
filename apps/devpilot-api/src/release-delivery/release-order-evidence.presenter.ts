import { presentBuildErrorMessage } from "./release-build.presenter";
import {
  type EvidenceBuildRow,
  type EvidenceDeploymentRow,
  type EvidenceProductionRow,
  type ReleaseOrderEvidenceRecord,
  ownsEvidenceManifest,
  ownsProductionDeployment,
} from "./release-order-evidence-ownership";

export function presentReleaseOrderEvidence(input: ReleaseOrderEvidenceRecord) {
  const buildRuns = input.buildRuns.map((run) => {
    const manifest = ownsEvidenceManifest(input, run.manifest, run.id);
    return presentBuild(run, manifest);
  });
  const stagingDeploymentRuns = input.stagingRuns.map((run) =>
    presentDeployment(input, run),
  );
  const productionReleaseRuns = input.productionRuns.map((run) => {
    const deploymentRuns = run.deploymentRuns
      .filter((deployment) => ownsProductionDeployment(input, run, deployment))
      .map((deployment) => presentDeployment(input, deployment));
    return {
      id: run.id,
      projectId: run.projectId,
      releaseOrderId: run.releaseOrderId,
      environmentId: run.environmentId,
      artifactManifestId: run.artifactManifestId,
      status: run.status,
      verifiedDigest: run.verifiedDigest,
      errorCode: run.errorCode,
      errorMessage: presentBuildErrorMessage(run.errorMessage),
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      createdAt: run.createdAt,
      environment: presentEnvironment(run.environment),
      manifest: presentManifest(run.artifactManifest),
      operationApproval: presentApproval(run.operationApproval),
      stagingProof: {
        deploymentRunId: run.stagingProof.id,
        environmentId: run.stagingProof.environmentId,
        finishedAt: run.stagingProof.finishedAt,
      },
      deploymentRuns,
    };
  });
  return {
    projectId: input.order.projectId,
    releaseOrderId: input.order.id,
    buildRuns: group(buildRuns, input.buildTotal),
    stagingDeploymentRuns: group(stagingDeploymentRuns, input.stagingTotal),
    productionReleaseRuns: group(productionReleaseRuns, input.productionTotal),
  };
}

function presentBuild(
  run: EvidenceBuildRow,
  manifest: EvidenceBuildRow["manifest"],
) {
  return {
    id: run.id,
    projectId: run.projectId,
    releaseOrderId: run.releaseOrderId,
    revision: run.revision,
    sourceBranch: run.sourceBranch,
    sourceCommitSha: run.sourceCommitSha,
    status: run.status,
    errorCode: run.errorCode,
    errorMessage: presentBuildErrorMessage(run.errorMessage),
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    createdAt: run.createdAt,
    manifest: manifest ? presentManifest(manifest) : null,
  };
}

function presentDeployment(
  input: ReleaseOrderEvidenceRecord,
  run: EvidenceDeploymentRow,
) {
  const environment = run.projectEnvironment;
  const manifest = run.artifactManifest;
  if (!environment || !manifest) {
    throw new Error("Release evidence relation missing");
  }
  return {
    id: run.id,
    projectId: run.projectId,
    releaseOrderId: input.order.id,
    releaseRunId: run.releaseRunId,
    environmentId: run.environmentId,
    artifactManifestId: run.artifactManifestId,
    status: run.status,
    executorKey: run.executorKey,
    adapterKey: run.adapterKey,
    branch: run.branch,
    commitSha: run.commitSha,
    error: presentBuildErrorMessage(run.error),
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    createdAt: run.createdAt,
    environment: presentEnvironment(environment),
    manifest: presentManifest(manifest),
  };
}

function presentManifest(manifest: NonNullable<EvidenceBuildRow["manifest"]>) {
  return {
    id: manifest.id,
    digest: manifest.digest,
    createdAt: manifest.createdAt,
    buildRun: {
      id: manifest.buildRun.id,
      revision: manifest.buildRun.revision,
      sourceBranch: manifest.buildRun.sourceBranch,
      sourceCommitSha: manifest.buildRun.sourceCommitSha,
    },
    items: manifest.items,
  };
}

function presentEnvironment(
  environment: NonNullable<EvidenceDeploymentRow["projectEnvironment"]>,
) {
  return {
    id: environment.id,
    name: environment.name,
    baselineRole: environment.baselineRole,
  };
}

function presentApproval(approval: EvidenceProductionRow["operationApproval"]) {
  if (!approval) throw new Error("Release evidence approval missing");
  return {
    id: approval.id,
    status: approval.status,
    requestedAt: approval.requestedAt,
    reviewedAt: approval.reviewedAt,
  };
}

function group<T>(items: T[], total: number) {
  return { items, total, hasMore: total > items.length };
}
