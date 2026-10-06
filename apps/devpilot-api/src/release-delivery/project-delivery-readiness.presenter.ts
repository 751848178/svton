import type { ProjectDeliverySummaryRecord } from "./project-delivery-summary.select";
import type {
  ProjectDeliveryBaselineRole,
  ProjectDeliveryCheckpoint,
} from "./project-delivery-summary.types";
import {
  projectDeliveryAction as action,
  projectDeliveryCheckpoint as checkpoint,
  projectDeliveryEnvironmentAction as environmentAction,
  projectDeliveryPolicyCheckpoint as policyCheckpoint,
  type ProjectDeliveryBaseline as Baseline,
} from "./project-delivery-checkpoint.presenter";
import {
  resolveProjectDeliveryConfigReadiness,
  resolveProjectDeliveryRouteReadiness,
  resolveProjectDeliveryTargetReadiness,
} from "./project-delivery-environment-readiness.policy";
import { resolveProjectDeliveryServiceParity } from "./project-delivery-service-parity.policy";
import {
  currentEnvironmentVersionFailureReason,
  exactCurrentEnvironmentVersion,
} from "./current-environment-version.utils";

export function projectDeliveryReadiness(
  project: ProjectDeliverySummaryRecord,
  intakeReady: boolean,
  providerKey: string,
) {
  const baselines = (["staging", "production"] as const).map((role) => ({
    role,
    environment: project.environments.find(
      (item) => item.status === "active" && item.baselineRole === role,
    ),
  }));
  const checkpoints: ProjectDeliveryCheckpoint[] = [
    checkpoint(
      "intake",
      "project",
      intakeReady,
      "repository_intake_incomplete",
      action(project.id, "review_repository", "/repository-analysis"),
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
    nextAction:
      checkpoints.find((item) => item.status !== "ready")?.action ?? null,
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
    action(projectId, "repair_baselines", "/repository-analysis"),
    baselines.flatMap(({ environment }) =>
      environment ? [`environment:${environment.id}`] : [],
    ),
  );
}

function serviceParity(projectId: string, baselines: Baseline[]) {
  const parity = resolveProjectDeliveryServiceParity(baselines);
  return checkpoint(
    "services",
    "project",
    parity.ready,
    parity.reasonCode,
    action(projectId, "configure_services", "?view=components"),
    parity.evidenceRefs,
  );
}

function environmentConfig(
  project: ProjectDeliverySummaryRecord,
  role: ProjectDeliveryBaselineRole,
  environment: Baseline["environment"],
) {
  if (!environment)
    return checkpoint(
      "config",
      role,
      false,
      "governed_baselines_incomplete",
      null,
    );
  const readiness = resolveProjectDeliveryConfigReadiness(project, environment);
  return policyCheckpoint(
    "config",
    role,
    readiness,
    environmentAction(
      project.id,
      environment,
      "configure_environment",
      readiness.tab,
    ),
  );
}

function environmentTarget(
  projectId: string,
  role: ProjectDeliveryBaselineRole,
  environment: Baseline["environment"],
  providerKey: string,
) {
  if (!environment)
    return checkpoint(
      "targets",
      role,
      false,
      "governed_baselines_incomplete",
      null,
    );
  const readiness = resolveProjectDeliveryTargetReadiness(
    environment,
    providerKey,
  );
  return policyCheckpoint(
    "targets",
    role,
    readiness,
    environmentAction(projectId, environment, "bind_target", "targets"),
  );
}

function environmentRoute(
  projectId: string,
  role: ProjectDeliveryBaselineRole,
  environment: Baseline["environment"],
) {
  if (!environment)
    return checkpoint(
      "routes",
      role,
      false,
      "governed_baselines_incomplete",
      null,
    );
  const readiness = resolveProjectDeliveryRouteReadiness(environment);
  return policyCheckpoint(
    "routes",
    role,
    readiness,
    environmentAction(projectId, environment, "configure_routes", "routes"),
  );
}

function release(project: ProjectDeliverySummaryRecord, baselines: Baseline[]) {
  const ready = baselines.every(({ environment }) =>
    Boolean(
      environment && exactCurrentEnvironmentVersion(project, environment),
    ),
  );
  const digestUnverified = baselines.some(
    ({ environment }) =>
      environment &&
      currentEnvironmentVersionFailureReason(environment) ===
        "current_version_digest_unverified",
  );
  return checkpoint(
    "release",
    "project",
    ready,
    digestUnverified
      ? "current_version_digest_unverified"
      : "release_action_required",
    action(project.id, "open_release", ""),
  );
}
