import type { ProjectDeliverySummaryRecord } from "./project-delivery-summary.select";
import type { ProjectDeliveryBaselineRole } from "./project-delivery-summary.types";

type ScopedResource = {
  teamId: string;
  projectId: string | null;
  environmentId: string | null;
};

export function projectDeliveryResourceSummary(
  project: ProjectDeliverySummaryRecord,
  environmentIds: Record<ProjectDeliveryBaselineRole, string | undefined>,
) {
  const rows: ScopedResource[] = [
    ...project.resourceInstances,
    ...project.managedResources,
    ...project.secretKeys,
    ...project.cdnConfigs,
    ...project.sites,
  ].filter((item) => exactResource(project, item));
  const activeIds = new Set(project.environments
    .filter((item) => item.status === "active" && exactEnvironment(project, item))
    .map((item) => item.id));
  return {
    bound: rows.filter((item) => item.environmentId && activeIds.has(item.environmentId)).length,
    total: rows.length,
    byEnvironment: {
      staging: countFor(rows, environmentIds.staging),
      production: countFor(rows, environmentIds.production),
    },
  };
}

export function projectDeliveryEntrySummary(
  project: ProjectDeliverySummaryRecord,
  productionEnvironmentId: string | undefined,
) {
  const activeIds = new Set(project.environments
    .filter((item) => item.status === "active" && exactEnvironment(project, item))
    .map((item) => item.id));
  const sites = project.sites.filter((site) =>
    exactResource(project, site) && site.primaryDomain.trim().length > 0);
  return {
    active: sites.filter((site) =>
      site.status === "active" && site.environmentId && activeIds.has(site.environmentId)).length,
    total: sites.length,
    productionDomain: sites.find((site) =>
      site.status === "active" && site.environmentId === productionEnvironmentId)
      ?.primaryDomain.trim() ?? null,
  };
}

function countFor(rows: ScopedResource[], environmentId: string | undefined) {
  return environmentId
    ? rows.filter((item) => item.environmentId === environmentId).length
    : 0;
}

function exactEnvironment(
  project: ProjectDeliverySummaryRecord,
  environment: ProjectDeliverySummaryRecord["environments"][number],
) {
  return environment.teamId === project.teamId && environment.projectId === project.id;
}

function exactResource(project: ProjectDeliverySummaryRecord, resource: ScopedResource) {
  return resource.teamId === project.teamId && resource.projectId === project.id;
}
