export const RESOURCE_REFERENCE_KINDS = [
  "managed_resource",
  "resource_instance",
  "site",
  "cdn_config",
] as const;

export type ResourceReferenceKind = (typeof RESOURCE_REFERENCE_KINDS)[number];
export type ReferenceRisk = "low" | "medium" | "high";

export type EnvironmentVariableBinding = {
  sourceKey: string;
  targetEnvKey: string;
};

export type ResourceReferenceInput = {
  kind: ResourceReferenceKind;
  id: string;
  sharedEnvironmentIds: string[];
  risk: ReferenceRisk;
  impact: string;
  componentKey?: string;
  envBindings?: EnvironmentVariableBinding[];
};

export type SafeResourceReference = ResourceReferenceInput & {
  name: string;
  stateful: boolean;
  resourceTypeKey?: string;
  resourceTypeCategory?: string | null;
};

export type SafeSecretReference = {
  id: string;
  name: string;
  type: string;
  targetEnvKey?: string;
};

export type SecretReferenceInput = Pick<SafeSecretReference, "id" | "targetEnvKey">;

export type SafePolicyReference = {
  id: string;
  name: string;
  effect: string;
  actions: unknown;
};

/**
 * F448 AC-SET-042/043/046: structured per-entry domain→component/port/path
 * mapping. The legacy flat `domains[]`/`proxyTarget` fields remain for
 * backward compatibility; `entries` is the structured form.
 */
export type RouteEntry = {
  domain: string;
  path: string;
  serviceId: string | null;
  component: string;
  port: number | null;
  tlsMode: "none" | "managed_cert" | "existing_cert_asset";
};

export type EnvironmentConfigSnapshot = {
  plainVariables: Record<string, string>;
  secretReferences: SafeSecretReference[];
  resourceReferences: SafeResourceReference[];
  routeSnapshot: Record<string, unknown>;
  policyReferences: SafePolicyReference[];
  observabilitySnapshot?: import("./environment-observability-snapshot.policy").EnvironmentObservabilitySnapshot | Record<string, never>;
};
