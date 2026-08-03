import type { ProjectDirectoryRecord } from "./project-directory.repository";
import type {
  ProjectConfigurationStatus,
  ProjectDirectoryActivity,
  ProjectDirectoryDeploymentSummary,
  ProjectDirectoryEnvironmentSummary,
  ProjectDirectoryItem,
  ProjectRuntimeStatus,
} from "./project-directory.types";

const RUNNING = new Set(["queued", "running"]);
const FAILED = new Set(["failed", "blocked"]);

export function toProjectDirectoryItem(
  project: ProjectDirectoryRecord,
): ProjectDirectoryItem {
  const staging = project.environments.find(
    (environment) => environment.baselineRole === "staging",
  );
  const production = project.environments.find(
    (environment) => environment.baselineRole === "production",
  );
  const repository = project.repositoryConnection
    ? {
        provider:
          project.repositoryIdentity?.provider ??
          project.repositoryConnection.provider,
        canonicalUrl: project.repositoryIdentity?.canonicalUrl ?? null,
        defaultBranch:
          project.repositoryIdentity?.defaultBranch ??
          project.repositoryConnection.defaultBranch ??
          project.repositoryConnection.selectedBranch,
        commitSha: project.repositoryConnection.commitSha,
        status: project.repositoryConnection.status,
      }
    : null;

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    onboardingStatus: project.onboardingStatus,
    runtimeStatus: runtimeStatus(project),
    configurationStatus: configurationStatus(
      project,
      Boolean(staging),
      Boolean(production),
    ),
    repository,
    baselines: {
      staging: staging ? environmentSummary(staging) : null,
      production: production ? environmentSummary(production) : null,
    },
    production: production
      ? {
          environmentId: production.id,
          latestDeployment: production.deploymentRuns[0]
            ? deploymentSummary(production.deploymentRuns[0])
            : null,
          currentVersion: null,
        }
      : null,
    domains: domains(project),
    activity: activity(project),
    counts: project._count,
    createdBy: project.createdBy,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function runtimeStatus(project: ProjectDirectoryRecord): ProjectRuntimeStatus {
  const statuses = [
    project.repositoryConnection?.status,
    project.repositoryAnalysisRuns[0]?.status,
    project.deploymentRuns[0]?.status,
    project.releasePlans[0]?.status,
  ].filter((status): status is string => Boolean(status));
  if (statuses.some((status) => RUNNING.has(status))) return "running";
  if (statuses.some((status) => FAILED.has(status))) return "failed";
  return "idle";
}

function configurationStatus(
  project: ProjectDirectoryRecord,
  hasStaging: boolean,
  hasProduction: boolean,
): ProjectConfigurationStatus {
  if (project.onboardingStatus === "draft") return "draft";
  if (["analyzing", "review"].includes(project.onboardingStatus ?? "")) {
    return "in_progress";
  }
  if (project.onboardingStatus === "ready" && hasStaging && hasProduction) {
    return "ready";
  }
  return "needs_configuration";
}

function environmentSummary(
  environment: ProjectDirectoryRecord["environments"][number],
): ProjectDirectoryEnvironmentSummary {
  return {
    id: environment.id,
    key: environment.key,
    name: environment.name,
    status: environment.status,
    baselineRole: environment.baselineRole,
    identityLockedAt: environment.identityLockedAt?.toISOString() ?? null,
    currentConfigRevisionId: environment.currentConfigRevisionId,
  };
}

function deploymentSummary(
  deployment: ProjectDirectoryRecord["environments"][number]["deploymentRuns"][number],
): ProjectDirectoryDeploymentSummary {
  return {
    id: deployment.id,
    status: deployment.status,
    dryRun: deployment.dryRun,
    commitSha: deployment.commitSha,
    startedAt: deployment.startedAt.toISOString(),
    finishedAt: deployment.finishedAt?.toISOString() ?? null,
  };
}

function domains(
  project: ProjectDirectoryRecord,
): ProjectDirectoryItem["domains"] {
  const values = new Map<string, ProjectDirectoryItem["domains"][number]>();
  for (const proxy of project.proxyConfigs) {
    values.set(proxy.domain, {
      domain: proxy.domain,
      status: proxy.status,
      source: "proxy",
    });
  }
  for (const site of project.sites) {
    values.set(site.primaryDomain, {
      domain: site.primaryDomain,
      status: site.status,
      source: "site",
    });
  }
  return [...values.values()].sort((left, right) =>
    left.domain.localeCompare(right.domain),
  );
}

function activity(project: ProjectDirectoryRecord): ProjectDirectoryActivity[] {
  const values: ProjectDirectoryActivity[] = [
    ...project.repositoryAnalysisRuns.map((run) => ({
      id: run.id,
      type: "analysis" as const,
      status: run.status,
      summary: null,
      occurredAt: run.createdAt.toISOString(),
    })),
    ...project.deploymentRuns.map((run) => ({
      id: run.id,
      type: "deployment" as const,
      status: run.status,
      summary: null,
      occurredAt: run.createdAt.toISOString(),
    })),
    ...project.releasePlans.map((plan) => ({
      id: plan.id,
      type: "release" as const,
      status: plan.status,
      summary: plan.name,
      occurredAt: plan.createdAt.toISOString(),
    })),
    ...project.auditEvents.map((event) => ({
      id: event.id,
      type: "audit" as const,
      status: event.status,
      summary: event.summary ?? event.action,
      occurredAt: event.occurredAt.toISOString(),
    })),
  ];
  return values
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 3);
}
