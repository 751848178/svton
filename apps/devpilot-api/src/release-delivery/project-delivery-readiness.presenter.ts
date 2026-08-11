import {
  resolveEnvironmentVariableRequirements,
  unresolvedEnvironmentVariableRequirements,
} from "../project-environment/environment-variable-requirement.resolver";
import type { ProjectDeliverySummaryRecord } from "./project-delivery-summary.select";
import type {
  ProjectDeliveryAction,
  ProjectDeliveryBaselineRole,
  ProjectDeliveryCheckpoint,
} from "./project-delivery-summary.types";

export function projectDeliveryReadiness(
  project: ProjectDeliverySummaryRecord,
  intakeReady: boolean,
) {
  const baselines = (["staging", "production"] as const).map((role) => ({
    role,
    environment: project.environments.find((item) =>
      item.status === "active" && item.baselineRole === role),
  }));
  const checkpoints: ProjectDeliveryCheckpoint[] = [
    checkpoint(
      "intake",
      "project",
      intakeReady,
      "repository_intake_incomplete",
      action(project.id, "review_repository", "/settings"),
    ),
    baselineTopology(project.id, baselines),
    serviceParity(project.id, baselines),
    ...baselines.flatMap(({ role, environment }) => [
      environmentConfig(project.id, role, environment),
      environmentTarget(project.id, role, environment),
      environmentRoute(project.id, role, environment),
    ]),
    release(project.id, baselines),
  ];
  return {
    checkpoints,
    nextAction: checkpoints.find((item) => item.status !== "ready")?.action ?? null,
  };
}

function baselineTopology(
  projectId: string,
  baselines: Baseline[],
): ProjectDeliveryCheckpoint {
  const exact = baselines.every(({ environment }) => Boolean(environment));
  return checkpoint(
    "baseline_topology",
    "project",
    exact,
    "governed_baselines_incomplete",
    action(projectId, "repair_baselines", "/settings"),
    baselines.flatMap(({ environment }) =>
      environment ? [`environment:${environment.id}`] : []),
  );
}

function serviceParity(projectId: string, baselines: Baseline[]) {
  const keys = baselines.map(({ environment }) =>
    (environment?.applicationServices ?? [])
      .map((service) => service.releaseComponentKey)
      .filter((key): key is string => Boolean(key))
      .sort(),
  );
  const ready = keys.every((items) => items.length > 0) &&
    JSON.stringify(keys[0]) === JSON.stringify(keys[1]);
  return checkpoint(
    "services",
    "project",
    ready,
    "baseline_service_topology_mismatch",
    action(projectId, "configure_services", "/settings?step=services"),
    keys.flatMap((items) => items.map((key) => `release-component:${key}`)),
  );
}

function environmentConfig(
  projectId: string,
  role: ProjectDeliveryBaselineRole,
  environment: Baseline["environment"],
) {
  const revision = environment?.currentConfigRevision;
  const unresolved = revision
    ? unresolvedEnvironmentVariableRequirements({
        requirements: resolveEnvironmentVariableRequirements(
          environment.applicationServices ?? [],
        ),
        plainVariables: revision.plainVariables,
        secretReferences: revision.secretReferences,
        resourceReferences: revision.resourceReferences,
      })
    : [];
  const ready = Boolean(revision) && unresolved.length === 0;
  return checkpoint(
    "config",
    role,
    ready,
    revision ? "required_variables_unresolved" : "config_revision_missing",
    environment
      ? action(projectId, "configure_variables", `/settings?environmentId=${environment.id}&step=variables`)
      : null,
    revision ? [`environment-config-revision:${revision.id}`] : [],
  );
}

function environmentTarget(
  projectId: string,
  role: ProjectDeliveryBaselineRole,
  environment: Baseline["environment"],
) {
  const count = environment?.serverBindings?.length ?? 0;
  return {
    ...checkpoint(
      "targets",
      role,
      count === 1,
      count > 1 ? "deployment_target_duplicate" : "deployment_target_missing",
      environment
        ? action(projectId, "bind_target", `/settings?environmentId=${environment.id}&step=target`)
        : null,
      environment?.serverBindings?.map((item) => `server-binding:${item.id}`) ?? [],
    ),
    status: count > 1 ? "blocked" as const : count === 1 ? "ready" as const : "action_required" as const,
  };
}

function environmentRoute(
  projectId: string,
  role: ProjectDeliveryBaselineRole,
  environment: Baseline["environment"],
) {
  const entries = record(environment?.currentConfigRevision?.routeSnapshot).entries;
  const ready = Array.isArray(entries) && entries.length > 0;
  return checkpoint(
    "routes",
    role,
    ready,
    "governed_route_missing",
    environment
      ? action(projectId, "configure_routes", `/settings?environmentId=${environment.id}&step=entry`)
      : null,
  );
}

function release(projectId: string, baselines: Baseline[]) {
  const ready = baselines.every(({ environment }) =>
    Boolean(environment?.currentEnvironmentVersion));
  return checkpoint(
    "release",
    "project",
    ready,
    "release_action_required",
    action(projectId, "open_release", ""),
  );
}

function checkpoint(
  id: ProjectDeliveryCheckpoint["id"],
  scope: ProjectDeliveryCheckpoint["scope"],
  ready: boolean,
  reasonCode: string,
  next: ProjectDeliveryAction | null,
  evidenceRefs: string[] = [],
): ProjectDeliveryCheckpoint {
  return {
    id,
    scope,
    status: ready ? "ready" : "action_required",
    reasonCodes: ready ? [] : [reasonCode],
    evidenceRefs,
    action: ready ? null : next,
  };
}

function action(projectId: string, kind: string, suffix: string) {
  return { kind, href: `/projects/${projectId}${suffix}` };
}

type Baseline = {
  role: ProjectDeliveryBaselineRole;
  environment: ProjectDeliverySummaryRecord["environments"][number] | undefined;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
