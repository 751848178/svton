import type { ProjectDeliverySummaryRecord } from "./project-delivery-summary.select";
import type {
  ProjectDeliveryAction,
  ProjectDeliveryBaselineRole,
  ProjectDeliveryCheckpoint,
} from "./project-delivery-summary.types";
import {
  resolveProjectDeliveryConfigReadiness,
  resolveProjectDeliveryRouteReadiness,
  resolveProjectDeliveryTargetReadiness,
  type EnvironmentSettingsTab,
} from "./project-delivery-environment-readiness.policy";
import { resolveProjectDeliveryServiceParity } from "./project-delivery-service-parity.policy";
import { exactCurrentEnvironmentVersion } from "./current-environment-version.utils";

export function projectDeliveryReadiness(
  project: ProjectDeliverySummaryRecord,
  intakeReady: boolean,
  providerKey: string,
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
      action(project.id, "review_repository", "/settings?section=repository"),
    ),
    baselineTopology(project.id, baselines),
    serviceParity(project.id, baselines),
    ...baselines.flatMap(({ role, environment }) => [
      environmentConfig(project, role, environment),
      environmentTarget(project.id, role, environment, providerKey),
      environmentRoute(project.id, role, environment),
    ]),
    release(project, baselines),
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
    action(projectId, "repair_baselines", "/settings?section=repository"),
    baselines.flatMap(({ environment }) =>
      environment ? [`environment:${environment.id}`] : []),
  );
}

function serviceParity(projectId: string, baselines: Baseline[]) {
  const parity = resolveProjectDeliveryServiceParity(baselines);
  return checkpoint(
    "services",
    "project",
    parity.ready,
    parity.reasonCode,
    action(projectId, "configure_services", "/settings?section=repository"),
    parity.evidenceRefs,
  );
}

function environmentConfig(
  project: ProjectDeliverySummaryRecord,
  role: ProjectDeliveryBaselineRole,
  environment: Baseline["environment"],
) {
  if (!environment) return checkpoint(
    "config",
    role,
    false,
    "governed_baselines_incomplete",
    null,
  );
  const readiness = resolveProjectDeliveryConfigReadiness(project, environment);
  return policyCheckpoint("config", role, readiness, environmentAction(
    project.id, environment, "configure_environment", readiness.tab));
}

function environmentTarget(
  projectId: string,
  role: ProjectDeliveryBaselineRole,
  environment: Baseline["environment"],
  providerKey: string,
) {
  if (!environment) return checkpoint("targets", role, false, "governed_baselines_incomplete", null);
  const readiness = resolveProjectDeliveryTargetReadiness(environment, providerKey);
  return policyCheckpoint("targets", role, readiness, environmentAction(
    projectId, environment, "bind_target", "targets"));
}

function environmentRoute(
  projectId: string,
  role: ProjectDeliveryBaselineRole,
  environment: Baseline["environment"],
) {
  if (!environment) return checkpoint("routes", role, false, "governed_baselines_incomplete", null);
  const readiness = resolveProjectDeliveryRouteReadiness(environment);
  return policyCheckpoint("routes", role, readiness, environmentAction(
    projectId, environment, "configure_routes", "routes"));
}

function release(project: ProjectDeliverySummaryRecord, baselines: Baseline[]) {
  const ready = baselines.every(({ environment }) =>
    Boolean(environment && exactCurrentEnvironmentVersion(project, environment)));
  return checkpoint(
    "release",
    "project",
    ready,
    "release_action_required",
    action(project.id, "open_release", ""),
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

function environmentAction(
  projectId: string,
  environment: NonNullable<Baseline["environment"]>,
  kind: string,
  tab: EnvironmentSettingsTab,
) {
  return action(
    projectId,
    kind,
    `/settings?section=environments&env=${encodeURIComponent(environment.key)}&envTab=${tab}`,
  );
}

function policyCheckpoint(
  id: ProjectDeliveryCheckpoint["id"],
  scope: ProjectDeliveryBaselineRole,
  readiness: { ready: boolean; blocked?: boolean; reasonCode: string; evidenceRefs: string[] },
  next: ProjectDeliveryAction,
) {
  const value = checkpoint(id, scope, readiness.ready, readiness.reasonCode, next, readiness.evidenceRefs);
  return { ...value, status: readiness.ready ? "ready" as const : readiness.blocked ? "blocked" as const : "action_required" as const };
}

type Baseline = {
  role: ProjectDeliveryBaselineRole;
  environment: ProjectDeliverySummaryRecord["environments"][number] | undefined;
};
