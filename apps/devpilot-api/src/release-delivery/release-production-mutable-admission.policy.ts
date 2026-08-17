import type { Prisma } from "@prisma/client";
import type { ProductionAdmissionProof } from "./release-production-admission.policy";
import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";
import { loadReleaseDeploymentInputState } from "./release-deployment-input-state.repository";
import { buildReleaseDeploymentInputSnapshot } from "./release-deployment-input-snapshot.utils";

export async function productionMutableEvidenceCurrent(
  tx: Prisma.TransactionClient,
  proof: ProductionAdmissionProof,
  scope: { teamId: string; projectId: string; environmentId: string },
) {
  const frozen = proof.deploymentSnapshot;
  const state = await loadReleaseDeploymentInputState(tx, {
    teamId: scope.teamId, projectId: scope.projectId,
    environmentId: scope.environmentId,
    configRevisionId: frozen.configRevision.id,
    label: "Production",
  }).catch(() => null);
  if (!state) return false;
  const rebuilt = buildReleaseDeploymentInputSnapshot(
    state, frozen.target.providerKey, frozen.globalEnvironmentKeys,
    frozen.componentEnvironmentKeys,
  ).snapshot;
  if (rebuilt.inputHash !== frozen.inputHash) return false;
  const byId = new Map(proof.checks.map((check) => [check.id, check]));
  const connection = identity(byId.get("D08"));
  if (!await latestRunsCurrent(tx.resourceConnectionRun, connection,
    ["succeeded", "completed"])) return false;
  const backup = identity(byId.get("D12"));
  if (!await latestRunsCurrent(tx.backupRun, backup, ["completed"])) return false;
  if (!await productionHistoryCurrent(tx, identity(byId.get("D19")), scope)) {
    return false;
  }
  for (const gateId of ["D14", "D15"]) {
    const evidence = identity(byId.get(gateId));
    if (Object.keys(evidence).length === 0) return false;
    if (!evidence.siteId) continue;
    const site = await tx.site.findFirst({ where: {
      id: stringValue(evidence.siteId),
      environmentId: stringValue(evidence.environmentId),
      primaryDomain: stringValue(evidence.hostname),
    }, select: { dns: true, tls: true } });
    const environment = await tx.projectEnvironment.findUnique({
      where: { id: stringValue(evidence.environmentId) },
      select: { currentConfigRevision: { select: { routeSnapshot: true } } },
    });
    const probe = gateId === "D14" ? record(site?.dns)
      : record(record(site?.tls).probe);
    const probeHost = gateId === "D14" ? probe.hostname : probe.host;
    const routeHash = hashCanonicalReleaseValue(record(
      environment?.currentConfigRevision?.routeSnapshot,
    ));
    if (!site || probeHost !== evidence.hostname || routeHash !== evidence.routeHash ||
      (gateId === "D14" ? probe.status !== "resolved" : probe.status !== "valid")) {
      return false;
    }
  }
  return true;
}

async function productionHistoryCurrent(
  tx: Prisma.TransactionClient,
  evidence: Record<string, string | number | null>,
  scope: { teamId: string; projectId: string; environmentId: string },
) {
  if (evidence.environmentId !== scope.environmentId ||
    !Object.prototype.hasOwnProperty.call(evidence, "currentVersionId")) {
    return false;
  }
  const environment = await tx.projectEnvironment.findFirst({ where: {
    id: scope.environmentId, teamId: scope.teamId, projectId: scope.projectId,
  }, select: { currentEnvironmentVersionId: true } });
  if (!environment || environment.currentEnvironmentVersionId !==
    evidence.currentVersionId) return false;
  if (evidence.currentVersionId === null) {
    if (!Object.prototype.hasOwnProperty.call(evidence, "historyCount") ||
      evidence.historyCount !== 0) return false;
    return await tx.environmentVersion.count({ where: {
      teamId: scope.teamId, projectId: scope.projectId,
      environmentId: scope.environmentId,
    } }) === 0;
  }
  const fields = ["versionId", "deploymentRunId", "deploymentStatus",
    "deploymentDryRun", "manifestId", "manifestDigest", "manifestItemCount"];
  if (!fields.every((key) => Object.prototype.hasOwnProperty.call(evidence, key))) {
    return false;
  }
  await tx.$queryRaw`SELECT ev.id FROM EnvironmentVersion ev
    INNER JOIN DeploymentRun dr ON dr.id = ev.deploymentRunId
    INNER JOIN ArtifactManifest am ON am.id = ev.artifactManifestId
    WHERE ev.id = ${String(evidence.currentVersionId)} FOR UPDATE`;
  await tx.$queryRaw`SELECT ami.id FROM ArtifactManifestItem ami
    WHERE ami.manifestId = ${String(evidence.manifestId)} FOR UPDATE`;
  const version = await tx.environmentVersion.findFirst({ where: {
    id: String(evidence.currentVersionId),
    teamId: scope.teamId, projectId: scope.projectId,
    environmentId: scope.environmentId,
  }, select: { id: true, deploymentRun: { select: { id: true, status: true,
    dryRun: true } }, artifactManifest: { select: { id: true, digest: true,
    _count: { select: { items: true } } } } } });
  return Boolean(version && version.id === evidence.versionId &&
    version.deploymentRun.id === evidence.deploymentRunId &&
    version.deploymentRun.status === evidence.deploymentStatus &&
    String(version.deploymentRun.dryRun) === evidence.deploymentDryRun &&
    version.artifactManifest.id === evidence.manifestId &&
    version.artifactManifest.digest === evidence.manifestDigest &&
    version.artifactManifest._count.items === evidence.manifestItemCount);
}

async function latestRunsCurrent(
  repository: { findFirst(input: unknown): Promise<{
    id: string; status: string; dryRun: boolean; environmentId: string | null;
  } | null> },
  evidence: Record<string, string | number | null>,
  statuses: string[],
) {
  const mappings = resourceRunMap(evidence.resourceRunMap);
  for (const [resourceId, expectedRunId] of mappings) {
    const run = await repository.findFirst({ where: {
      resourceId, environmentId: stringValue(evidence.environmentId),
    }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    if (!run || run.id !== expectedRunId || run.dryRun ||
      !statuses.includes(run.status)) return false;
  }
  return true;
}

function identity(check?: ProductionAdmissionProof["checks"][number]) {
  return check?.evidenceIdentity ?? {};
}
function resourceRunMap(value: unknown): string[][] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) =>
      Array.isArray(item) && item.length === 2 && item.every(text)) ? parsed : [];
  } catch { return []; }
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
function stringValue(value: unknown) { return text(value) ? value : ""; }
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
