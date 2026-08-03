export const RESOURCE_REFERENCE_KINDS = [
  "managed_resource",
  "resource_instance",
  "site",
  "cdn_config",
] as const;

export type ResourceReferenceKind = (typeof RESOURCE_REFERENCE_KINDS)[number];
export type ReferenceRisk = "low" | "medium" | "high";

export type ResourceReferenceInput = {
  kind: ResourceReferenceKind;
  id: string;
  sharedEnvironmentIds: string[];
  risk: ReferenceRisk;
  impact: string;
};

export type SafeResourceReference = ResourceReferenceInput & {
  name: string;
};

export type SafeSecretReference = {
  id: string;
  name: string;
  type: string;
};

export type SafePolicyReference = {
  id: string;
  name: string;
  effect: string;
  actions: unknown;
};

export type EnvironmentConfigSnapshot = {
  plainVariables: Record<string, string>;
  secretReferences: SafeSecretReference[];
  resourceReferences: SafeResourceReference[];
  routeSnapshot: Record<string, unknown>;
  policyReferences: SafePolicyReference[];
};
