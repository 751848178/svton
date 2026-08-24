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

  // 组件列：各环境 active 服务组件按名去重（服务随环境重复声明），
  // 端口取声明列表中第一个数字。
  const components = project.environments.flatMap((environment) =>
    environment.applicationServices.map((service) => ({
      name: service.name,
      port: firstPort(service.ports),
    })),
  ).filter((component, index, all) =>
    all.findIndex((item) => item.name === component.name) === index);
  // 动态环境列：项目全部环境 + 各环境当前生效版本（select 已按 sortOrder 排序）。
  const environmentColumns = project.environments.map((environment) => {
    const version = presentProjectDeliveryCurrentVersion(project, environment);
    return {
      id: environment.id,
      key: environment.key,
      name: environment.name,
      baselineRole: environment.baselineRole,
      currentVersion: version?.releaseVersion ?? null,
      currentVersionEffectiveAt: version?.effectiveAt ?? null,
    };
  });
  // 最近一次发布时间 = 各环境当前版本生效时间的最大值。
  const latestReleaseAt = environmentColumns.reduce<string | null>((latest, column) => {
    if (!column.currentVersionEffectiveAt) return latest;
    return !latest || column.currentVersionEffectiveAt > latest
      ? column.currentVersionEffectiveAt
      : latest;
  }, null);

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
    components,
    environments: environmentColumns,
    latestReleaseAt,
    activity: projectDirectoryActivity(project),
    checkpoints: readiness.checkpoints,
    nextAction: readiness.nextAction,
  };
}

function firstPort(ports: unknown): number | null {
  if (!Array.isArray(ports)) return null;
  for (const port of ports) {
    const parsed = typeof port === 'number' ? port : Number(port);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}
