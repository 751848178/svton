import { isStoredConnectionAligned } from "../repository-identity/repository-identity-policy.utils";
import { repositoryIntakeSummary } from "../project-intake/repository-intake-summary.utils";
import { projectDirectoryActivity } from "./project-directory-activity.utils";
import type { ProjectDirectoryRecord } from "./project-directory.repository";
import {
  productionSummary,
  projectDirectoryStatus,
} from "./project-directory-status.utils";
import type { ProjectDirectoryItem } from "./project-directory.types";
import { projectDeliveryReadiness } from "../release-delivery/project-delivery-readiness.presenter";
import { isProjectDeliveryBaseline } from "../release-delivery/project-delivery-baseline.policy";
import { presentCompleteProjectDeliveryBaseline, presentProjectDeliveryCurrentVersion } from
  "../release-delivery/project-delivery-complete-baseline.presenter";

export function toProjectDirectoryItem(
  project: ProjectDirectoryRecord,
  providerKey: string,
): ProjectDirectoryItem {
  const staging = project.environments.find(
    (environment) => isProjectDeliveryBaseline(project, environment, "staging"),
  );
  const production = project.environments.find(
    (environment) => isProjectDeliveryBaseline(project, environment, "production"),
  );
  const repositoryReady = isStoredConnectionAligned(
    project.repositoryIdentity,
    project.repositoryConnection,
  );
  const repository =
    repositoryReady && project.repositoryIdentity?.canonicalUrl
      ? {
          provider: project.repositoryIdentity.provider,
          canonicalUrl: project.repositoryIdentity.canonicalUrl,
        }
      : null;
  const liveProduction = productionSummary(project, production);
  const intake = repositoryIntakeSummary(project);
  const readiness = projectDeliveryReadiness(
    project,
    Boolean(repository && intake.componentCount !== null),
    providerKey,
  );
  const stagingVersion = presentProjectDeliveryCurrentVersion(project, staging);
  const productionVersion = presentProjectDeliveryCurrentVersion(project, production);
  const stagingSummary = presentCompleteProjectDeliveryBaseline(project, staging,
    "staging", stagingVersion, readiness.checkpoints);
  const productionBaseline = presentCompleteProjectDeliveryBaseline(project, production,
    "production", productionVersion, readiness.checkpoints);

  return {
    id: project.id,
    name: project.name,
    status: projectDirectoryStatus(readiness.checkpoints,
      [stagingSummary, productionBaseline]),
    repository,
    intake,
    baselines: {
      staging: stagingSummary,
      production: productionBaseline,
    },
    production: liveProduction,
    activity: projectDirectoryActivity(project),
    checkpoints: readiness.checkpoints,
    nextAction: readiness.nextAction,
  };
}
