import { isStoredConnectionAligned } from "../repository-identity/repository-identity-policy.utils";
import { projectDirectoryActivity } from "./project-directory-activity.utils";
import { projectDirectoryIntake } from "./project-directory-intake.utils";
import type { ProjectDirectoryRecord } from "./project-directory.repository";
import {
  baselineSummary,
  productionSummary,
  projectDirectoryStatus,
} from "./project-directory-status.utils";
import type { ProjectDirectoryItem } from "./project-directory.types";

export function toProjectDirectoryItem(
  project: ProjectDirectoryRecord,
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

  return {
    id: project.id,
    name: project.name,
    status: projectDirectoryStatus(project, {
      repositoryReady,
      stagingReady: stagingSummary?.ready === true,
      productionReady: productionBaseline?.ready === true,
      productionOnline: liveProduction.currentVersion !== null,
    }),
    repository,
    intake: projectDirectoryIntake(project),
    baselines: {
      staging: stagingSummary,
      production: productionBaseline,
    },
    production: liveProduction,
    activity: projectDirectoryActivity(project),
  };
}
