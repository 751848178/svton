/**
 * Shared project-environment domain types.
 *
 * These types are consumed by the sync-suggestions read/apply services and the
 * sync-diff pure utils. They live here (rather than on the host facade) so the
 * facade stays a thin delegation layer under the file-size ceiling.
 */

export type SuggestionSeverity = 'info' | 'warning' | 'critical';

export interface DeployConfigCoverage {
  total: number;
  workingDirectory: number;
  buildCommand: number;
  deployCommand: number;
  healthCheckUrl: number;
  rollbackCommand: number;
}

export type DeployConfigField = keyof Omit<DeployConfigCoverage, 'total'>;

export interface EnvironmentSyncProfile {
  environment: {
    id: string;
    key: string;
    name: string;
    status: string;
    sortOrder: number;
  };
  isReference: boolean;
  serverRoleKeys: string[];
  serverKeys: string[];
  serviceKeys: string[];
  resourceKindKeys: string[];
  siteRuntimeKeys: string[];
  secretTypeKeys: string[];
  cdnProviderKeys: string[];
  counts: {
    serverBindings: number;
    services: number;
    managedResources: number;
    resourceInstances: number;
    resources: number;
    sites: number;
    cdnConfigs: number;
    secretKeys: number;
    deploymentRuns: number;
  };
  deployConfigCoverage: DeployConfigCoverage;
  serviceBindingGapCount: number;
  tlsSiteCount: number;
  successfulDeployments: number;
}

export interface EnvironmentSyncDifferences {
  missing: {
    serverRoles: string[];
    services: string[];
    resourceKinds: string[];
    siteRuntimeTypes: string[];
    secretTypes: string[];
    cdnProviders: string[];
  };
  extra: {
    serverRoles: string[];
    services: string[];
    resourceKinds: string[];
    siteRuntimeTypes: string[];
    secretTypes: string[];
    cdnProviders: string[];
  };
  deployConfigGaps: Array<{ field: DeployConfigField; missingCount: number }>;
  serviceBindingGapDelta: number;
  tlsSiteGap: number;
  successfulDeploymentGap: boolean;
}

export interface EnvironmentSyncSuggestionAction {
  kind: string;
  severity: SuggestionSeverity;
  title: string;
  description: string;
  target: 'resource-control' | 'applications' | 'sites' | 'keys' | 'cdn-configs';
  metadata: Record<string, unknown>;
}
