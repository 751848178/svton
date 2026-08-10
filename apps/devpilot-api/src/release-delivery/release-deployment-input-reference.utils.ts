import { RESOURCE_REFERENCE_KINDS } from "../project-environment/environment-config-revision.types";

export interface DeploymentResourceReference {
  id: string;
  kind: (typeof RESOURCE_REFERENCE_KINDS)[number];
  sharedEnvironmentIds: string[];
}

export function deploymentReferenceIds(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.type === "string"
          ? [item.id]
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
        item.sharedEnvironmentIds.every((id) => typeof id === "string")
          ? [
              {
                id: item.id,
                kind: item.kind as (typeof RESOURCE_REFERENCE_KINDS)[number],
                sharedEnvironmentIds: item.sharedEnvironmentIds as string[],
              },
            ]
          : [],
      )
    : [];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
