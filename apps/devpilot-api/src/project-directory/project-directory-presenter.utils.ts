import { isStoredConnectionAligned } from "../repository-identity/repository-identity-policy.utils";
import { repositoryIntakeSummary } from "../project-intake/repository-intake-summary.utils";
import { projectDirectoryActivity } from "./project-directory-activity.utils";
import type { ProjectDirectoryRecord } from "./project-directory.repository";
import {
  baselineSummary,
  productionSummary,
  projectDirectoryStatus,
} from "./project-directory-status.utils";
import type { ProjectDirectoryItem } from "./project-directory.types";
import { projectDeliveryReadiness } from "../release-delivery/project-delivery-readiness.presenter";

export function toProjectDirectoryItem(
  project: ProjectDirectoryRecord,
  providerKey: string,
): ProjectDirectoryItem {
  const staging = project.environments.find(
    (environment) => environment.baselineRole === "staging",
  );
  const production = project.environments.find(
    (environment) => environment.baselineRole === "production",
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
  const stagingSummary = staging ? baselineSummary(staging) : null;
  const productionBaseline = production ? baselineSummary(production) : null;
  const liveProduction = productionSummary(project, production);
  const intake = repositoryIntakeSummary(project);
  const readiness = projectDeliveryReadiness(
    project,
    Boolean(repository && intake.componentCount !== null),
    providerKey,
  );

  return {
    id: project.id,
    name: project.name,
    status: projectDirectoryStatus(readiness.checkpoints),
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
