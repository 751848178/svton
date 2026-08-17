import { hashEnvironmentConfigSnapshot } from "../project-environment/environment-config-revision.utils";
import {
  resolveEnvironmentVariableRequirements,
  unresolvedEnvironmentVariableRequirements,
} from "../project-environment/environment-variable-requirement.resolver";
import { resolveRouteSnapshotTargetIssues } from "../project-environment/environment-route-target-validator";
import { resolveReleaseDeploymentTargetReadiness } from "./release-deployment-target-readiness.model";
import type { ProjectDeliverySummaryRecord } from "./project-delivery-summary.select";

type Environment = ProjectDeliverySummaryRecord["environments"][number];
type Project = ProjectDeliverySummaryRecord;
export type EnvironmentSettingsTab = "targets" | "resources" | "variables" | "routes" | "protection";
type Readiness = {
  ready: boolean;
  blocked?: boolean;
  reasonCode: string;
  tab: EnvironmentSettingsTab;
  evidenceRefs: string[];
};

export function resolveProjectDeliveryTargetReadiness(
  environment: Environment,
  providerKey: string,
): Readiness {
  const result = resolveReleaseDeploymentTargetReadiness(
    environment.serverBindings,
    providerKey,
  );
  return {
    ready: result.matchState === "ready",
    blocked: !["ready", "missing"].includes(result.matchState),
    reasonCode: result.reasonCode,
    tab: "targets",
    evidenceRefs: environment.serverBindings.map((item) => `server-binding:${item.id}`),
  };
}

export function resolveProjectDeliveryConfigReadiness(
  project: Project,
  environment: Environment,
): Readiness {
  const revision = environment.currentConfigRevision;
  if (!revision || environment.currentConfigRevisionId !== revision.id) {
    return result("config_revision_missing", "variables");
  }
  if (
    revision.teamId !== project.teamId ||
    revision.projectId !== project.id ||
    revision.environmentId !== environment.id
  ) return result("config_revision_scope_invalid", "protection", true);
  const plain = record(revision.plainVariables);
  const secrets = records(revision.secretReferences);
  const resources = records(revision.resourceReferences);
  const policies = records(revision.policyReferences);
  if (
    Object.entries(plain).some(([key, value]) =>
      !/^[A-Z_][A-Z0-9_]*$/.test(key) || typeof value !== "string") ||
    secrets.length !== arrayLength(revision.secretReferences)
  ) return result("config_revision_invalid", "variables", true);
  const unsafeSecret = secrets.some((item) =>
    ["value", "secret", "plaintext", "secretPlaintext"].some((key) => key in item));
  const missingSecret = secrets.some((item) =>
    typeof item.id !== "string" || !project.secretKeys.some((row) =>
      row.id === item.id && (!row.environmentId || row.environmentId === environment.id)));
  if (unsafeSecret || missingSecret) {
    return result("secret_reference_invalid", "variables", true);
  }
  if (!resources.every((item) => validResource(project, environment.id, item))) {
    return result("resource_reference_invalid", "resources", true);
  }
  if (policies.length !== arrayLength(revision.policyReferences)) {
    return result("policy_reference_invalid", "protection", true);
  }
  const unresolved = unresolvedEnvironmentVariableRequirements({
    requirements: resolveEnvironmentVariableRequirements(environment.applicationServices),
    plainVariables: revision.plainVariables,
    secretReferences: revision.secretReferences,
    resourceReferences: revision.resourceReferences,
  });
  if (unresolved.length) {
    return result(
      unresolved.some((item) => item.secret)
        ? "required_secret_variables_unresolved"
        : "required_plain_variables_unresolved",
      "variables",
    );
  }
  const snapshot = {
    plainVariables: revision.plainVariables,
    secretReferences: revision.secretReferences,
    resourceReferences: revision.resourceReferences,
    routeSnapshot: revision.routeSnapshot,
    policyReferences: revision.policyReferences,
  } as never;
  if (hashEnvironmentConfigSnapshot(snapshot) !== revision.snapshotHash) {
    return result("config_revision_hash_invalid", "protection", true);
  }
  return {
    ...result("config_revision_complete", "variables"),
    ready: true,
    evidenceRefs: [`environment-config-revision:${revision.id}`],
  };
}

export function resolveProjectDeliveryRouteReadiness(environment: Environment): Readiness {
  const revision = environment.currentConfigRevision;
  const route = record(revision?.routeSnapshot);
  const entries = Array.isArray(route.entries) ? route.entries : [];
  if (!revision || entries.length === 0) return result("governed_route_missing", "routes");
  const issue = resolveRouteSnapshotTargetIssues(
    { baselineRole: environment.baselineRole },
    route,
    environment.applicationServices,
  )[0];
  return issue
    ? result(issue.code, "routes", true)
    : {
        ...result("governed_route_ready", "routes"),
        ready: true,
        evidenceRefs: [`environment-config-revision:${revision.id}#routes`],
      };
}

function validResource(project: Project, environmentId: string, item: Record<string, unknown>) {
  if (typeof item.id !== "string" || typeof item.kind !== "string") return false;
  const shared = item.sharedEnvironmentIds;
  if (!Array.isArray(shared) || !shared.includes(environmentId)) return false;
  const collections: Record<string, Array<{ id: string; environmentId: string | null }>> = {
    resource_instance: project.resourceInstances,
    managed_resource: project.managedResources,
    site: project.sites,
    cdn_config: project.cdnConfigs,
  };
  return Boolean(collections[item.kind]?.some((row) =>
    row.id === item.id && (!row.environmentId || shared.includes(row.environmentId))));
}

function result(reasonCode: string, tab: EnvironmentSettingsTab, blocked = false): Readiness {
  return { ready: false, blocked, reasonCode, tab, evidenceRefs: [] };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function records(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function arrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : -1;
}
