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
      mode: run.mode,
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
    siteProbe: presentSiteProbe(run.result),
    routeSwitch: presentRouteSwitch(run.result),
  };
}

function presentSiteProbe(result: unknown) {
  const value = recordValue(result);
  const siteProbe = recordValue(value.siteProbe);
  if (Object.keys(siteProbe).length === 0) return null;
  const dns = recordValue(siteProbe.dns);
  const tls = recordValue(siteProbe.tls);
  const http = recordValue(siteProbe.http);
  return {
    version: numberValue(siteProbe.version),
    primaryDomain: stringValue(siteProbe.primaryDomain),
    finalUrl: stringValue(siteProbe.finalUrl),
    probedAt: stringValue(siteProbe.probedAt),
    dns: {
      status: stringValue(dns.status),
      hostname: stringValue(dns.hostname),
      records: arrayOfStrings(dns.records),
      error: presentProbeError(dns.error),
      checkedAt: stringValue(dns.checkedAt),
    },
    tls: {
      status: stringValue(tls.status),
      host: stringValue(tls.host),
      port: numberValue(tls.port),
      servername: stringValue(tls.servername),
      cert: presentProbeTlsCert(tls.cert),
      error: presentProbeError(tls.error),
      checkedAt: stringValue(tls.checkedAt),
    },
    http: {
      status: stringValue(http.status),
      url: stringValue(http.url),
      finalUrl: stringValue(http.finalUrl),
      statusCode: numberValue(http.statusCode),
      bodySignature: stringValue(http.bodySignature),
      error: presentProbeError(http.error),
      checkedAt: stringValue(http.checkedAt),
    },
  };
}

function presentProbeTlsCert(cert: unknown) {
  const value = recordValue(cert);
  if (Object.keys(value).length === 0) return null;
  return {
    subject: stringValue(value.subject),
    issuer: stringValue(value.issuer),
    validFrom: stringValue(value.validFrom),
    validUntil: stringValue(value.validUntil),
    expired: booleanValue(value.expired),
  };
}

function presentProbeError(error: unknown) {
  const value = recordValue(error);
  if (Object.keys(value).length === 0) return null;
  return {
    code: stringValue(value.code),
    message: stringValue(value.message),
  };
}

function presentRouteSwitch(result: unknown) {
  const value = recordValue(result);
  const routeSwitch = recordValue(value.routeSwitch);
  if (Object.keys(routeSwitch).length === 0) return null;
  return {
    version: numberValue(routeSwitch.version),
    siteId: stringValue(routeSwitch.siteId),
    primaryDomain: stringValue(routeSwitch.primaryDomain),
    deploymentRunId: stringValue(routeSwitch.deploymentRunId),
    releaseRunId: stringValue(routeSwitch.releaseRunId),
    targetRef: stringValue(routeSwitch.targetRef),
    proxyTarget: stringValue(routeSwitch.proxyTarget),
    domains: arrayOfStrings(routeSwitch.domains),
    status: stringValue(routeSwitch.status),
    reasonCode: stringValue(routeSwitch.reasonCode),
    switchedAt: stringValue(routeSwitch.switchedAt),
  };
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function arrayOfStrings(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string");
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
    risk: approval.risk,
    summary: approval.summary,
    requesterId: approval.requesterId,
    reviewerId: approval.reviewerId,
    requester: presentActor(approval.requester),
    reviewer: presentActor(approval.reviewer),
    reviewComment: approval.reviewComment,
    requestedAt: approval.requestedAt,
    reviewedAt: approval.reviewedAt,
    consumedAt: approval.consumedAt,
    expiresAt: approval.expiresAt,
  };
}

function presentActor(
  actor: NonNullable<EvidenceProductionRow["operationApproval"]>["reviewer"],
) {
  return actor ? { id: actor.id, name: actor.name, email: actor.email } : null;
}

function group<T>(items: T[], total: number) {
  return { items, total, hasMore: total > items.length };
}
