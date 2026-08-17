import { repositoryIntakeSummary } from "../project-intake/repository-intake-summary.utils";
import { isStoredConnectionAligned } from "../repository-identity/repository-identity-policy.utils";
import type { ProjectDeliverySummaryRecord } from "./project-delivery-summary.select";
import type {
  ProjectDeliveryBaselineRole,
  ProjectDeliverySummaryResponse,
} from "./project-delivery-summary.types";
import { projectDeliveryReadiness } from "./project-delivery-readiness.presenter";
import {
  isProjectDeliveryBaseline,
} from "./project-delivery-baseline.policy";
import { presentCompleteProjectDeliveryBaseline, presentProjectDeliveryCurrentVersion } from
  "./project-delivery-complete-baseline.presenter";
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
  const stagingVersion = presentProjectDeliveryCurrentVersion(project, staging);
  const productionVersion = presentProjectDeliveryCurrentVersion(project, production);
  return {
    version: 2,
    scope: { teamId: project.teamId, actorId, projectId: project.id },
    project: { id: project.id, name: project.name },
    repository: repository(project),
    intake,
    baselines: {
      staging: presentCompleteProjectDeliveryBaseline(project, staging, "staging", stagingVersion,
        readiness.checkpoints),
      production: presentCompleteProjectDeliveryBaseline(project, production, "production", productionVersion,
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
