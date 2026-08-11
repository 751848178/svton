import { repositoryIntakeSummary } from "../project-intake/repository-intake-summary.utils";
import { isStoredConnectionAligned } from "../repository-identity/repository-identity-policy.utils";
import { exactCurrentEnvironmentVersion } from "./current-environment-version.utils";
import type { ProjectDeliverySummaryRecord } from "./project-delivery-summary.select";
import type {
  ProjectDeliveryBaselineRole,
  ProjectDeliveryCurrentVersionSummary,
  ProjectDeliverySummaryResponse,
} from "./project-delivery-summary.types";
import { projectDeliveryReadiness } from "./project-delivery-readiness.presenter";
import {
  isProjectDeliveryBaseline,
  presentProjectDeliveryBaseline,
} from "./project-delivery-baseline.policy";
import {
  projectDeliveryEntrySummary,
  projectDeliveryResourceSummary,
} from "./project-delivery-scope-summary.presenter";

type Environment = ProjectDeliverySummaryRecord["environments"][number];
export function presentProjectDeliverySummary(
  project: ProjectDeliverySummaryRecord,
  actorId: string,
  providerKey: string,
): ProjectDeliverySummaryResponse {
  const staging = baseline(project, "staging");
  const production = baseline(project, "production");
  const resources = projectDeliveryResourceSummary(project, {
    staging: staging?.id,
    production: production?.id,
  });
  const entries = projectDeliveryEntrySummary(project, production?.id);
  const intake = repositoryIntakeSummary(project);
  const readiness = projectDeliveryReadiness(
    project,
    Boolean(repository(project) && intake.componentCount !== null),
    providerKey,
  );
  const stagingVersion = currentVersion(project, staging);
  const productionVersion = currentVersion(project, production);
  return {
    version: 2,
    scope: { teamId: project.teamId, actorId, projectId: project.id },
    project: { id: project.id, name: project.name },
    repository: repository(project),
    intake,
    baselines: {
      staging: completeBaseline(project, staging, "staging", stagingVersion, readiness.checkpoints),
      production: completeBaseline(project, production, "production", productionVersion,
        readiness.checkpoints),
    },
    resources,
    entries: { ...entries, unit: "site" },
    currentVersions: {
      staging: stagingVersion,
      production: productionVersion,
    },
    ...readiness,
  };
}

function completeBaseline(
  project: ProjectDeliverySummaryRecord,
  environment: Environment | undefined,
  role: ProjectDeliveryBaselineRole,
  version: ProjectDeliveryCurrentVersionSummary | null,
  checkpoints: ReturnType<typeof projectDeliveryReadiness>["checkpoints"],
) {
  if (!environment) return null;
  const baseline = presentProjectDeliveryBaseline(project, environment);
  const required = checkpoints.filter((item) => item.scope === role ||
    (item.scope === "project" && item.id !== "release"));
  return { ...baseline, ready: baseline.ready && Boolean(version) &&
    required.every((item) => item.status === "ready") };
}

function repository(project: ProjectDeliverySummaryRecord) {
  const identity = project.repositoryIdentity;
  const revision = identity?.currentRevision;
  const scoped =
    identity?.teamId === project.teamId &&
    identity.projectId === project.id &&
    identity.lockedAt !== null &&
    revision?.teamId === project.teamId &&
    revision.projectId === project.id;
  if (
    !scoped ||
    !isStoredConnectionAligned(identity, project.repositoryConnection)
  ) {
    return null;
  }
  return {
    provider: identity.provider,
    canonicalUrl: identity.canonicalUrl,
    defaultBranch: revision.defaultBranch,
  };
}

function baseline(
  project: ProjectDeliverySummaryRecord,
  role: ProjectDeliveryBaselineRole,
) {
  return project.environments.find(
    (item) =>
      isProjectDeliveryBaseline(project, item, role),
  );
}

function currentVersion(
  project: ProjectDeliverySummaryRecord,
  environment: Environment | undefined,
): ProjectDeliveryCurrentVersionSummary | null {
  if (!environment) return null;
  const version = exactCurrentEnvironmentVersion(project, environment);
  const digest = version?.artifactManifest.digest?.trim();
  if (!version || !digest) return null;
  return {
    id: version.id,
    releaseOrderId: version.releaseOrder.id,
    releaseVersion: version.releaseOrder.releaseVersion,
    artifactManifestId: version.artifactManifest.id,
    manifestDigest: digest,
    deploymentRunId: version.deploymentRun.id,
    effectiveAt: version.effectiveAt.toISOString(),
  };
}
