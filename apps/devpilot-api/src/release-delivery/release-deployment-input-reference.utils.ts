import { RESOURCE_REFERENCE_KINDS } from "../project-environment/environment-config-revision.types";

export interface DeploymentResourceReference {
  id: string;
  kind: (typeof RESOURCE_REFERENCE_KINDS)[number];
  sharedEnvironmentIds: string[];
  componentKey?: string;
  envBindings?: Array<{ sourceKey: string; targetEnvKey: string }>;
}

export interface DeploymentSecretReference {
  id: string;
  targetEnvKey?: string;
}

export function deploymentSecretReferences(value: unknown): DeploymentSecretReference[] {
  return Array.isArray(value)
    ? value.flatMap((item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.type === "string" &&
        (item.targetEnvKey === undefined || (
          typeof item.targetEnvKey === "string" &&
          /^[A-Z_][A-Z0-9_]*$/.test(item.targetEnvKey)
        ))
          ? [{
              id: item.id,
              ...(typeof item.targetEnvKey === "string" ? { targetEnvKey: item.targetEnvKey } : {}),
            }]
          : [],
      )
    : [];
}

export function deploymentResourceReferences(
  value: unknown,
): DeploymentResourceReference[] {
  return Array.isArray(value)
    ? value.flatMap((item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        RESOURCE_REFERENCE_KINDS.includes(item.kind as never) &&
        Array.isArray(item.sharedEnvironmentIds) &&
        item.sharedEnvironmentIds.every((id) => typeof id === "string") &&
        (item.componentKey === undefined || typeof item.componentKey === "string") &&
        (item.envBindings === undefined || validEnvBindings(item.envBindings))
          ? [
              {
                id: item.id,
                kind: item.kind as (typeof RESOURCE_REFERENCE_KINDS)[number],
                sharedEnvironmentIds: item.sharedEnvironmentIds as string[],
                ...(typeof item.componentKey === "string"
                  ? { componentKey: item.componentKey }
                  : {}),
                ...(validEnvBindings(item.envBindings)
                  ? { envBindings: item.envBindings }
                  : {}),
              },
            ]
          : [],
      )
    : [];
}

function validEnvBindings(value: unknown): value is Array<{ sourceKey: string; targetEnvKey: string }> {
  return Array.isArray(value) && value.every((entry) =>
    isRecord(entry) &&
    typeof entry.sourceKey === "string" &&
    typeof entry.targetEnvKey === "string");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
