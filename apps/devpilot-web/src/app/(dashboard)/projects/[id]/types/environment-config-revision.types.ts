export type EnvironmentConfigResourceReference = {
  kind: 'managed_resource' | 'resource_instance' | 'site' | 'cdn_config';
  id: string;
  name: string;
  sharedEnvironmentIds: string[];
  risk: 'low' | 'medium' | 'high';
  impact: string;
  componentKey?: string;
  envBindings?: Array<{ sourceKey: string; targetEnvKey: string }>;
  bindingStatus?: 'configured' | 'needs_configuration';
};

export type EnvironmentConfigSecretReference = {
  id: string;
  targetEnvKey: string;
};

export type EnvironmentConfigRouteEntry = {
  domain: string;
  path: string;
  serviceId?: string | null;
  component: string;
  port: number | null;
  tlsMode: 'managed_cert' | 'existing_cert_asset';
};

export type EnvironmentConfigRevision = {
  id: string;
  revision: number;
  snapshotHash: string;
  plainVariables: Record<string, string>;
  secretReferences: Array<{
    id: string;
    name: string;
    type: string;
    targetEnvKey?: string;
  }>;
  resourceReferences: EnvironmentConfigResourceReference[];
  routeSnapshot: {
    domains?: string[];
    dnsProvider?: string | null;
    tlsRequired?: boolean;
    proxyTarget?: string | null;
    entries?: EnvironmentConfigRouteEntry[];
  };
  policyReferences: Array<{ id: string; name: string; effect: string; actions: unknown }>;
  displayName?: string | null;
  displayDescription?: string | null;
  changeSummary?: string | null;
  source: string;
  createdAt: string;
  current: boolean;
  createdBy?: { id: string; name?: string | null; email: string } | null;
};

export type EnvironmentConfigRevisionList = {
  environmentId: string;
  currentConfigRevisionId: string | null;
  revisions: EnvironmentConfigRevision[];
};

export type CreateEnvironmentConfigRevisionResult = {
  environment: {
    id: string;
    key: string;
    name: string;
    status: string;
    config: { envVars?: Record<string, string>; [key: string]: unknown } | null;
    identityLockedAt: string | null;
    currentConfigRevisionId: string;
  };
  revision: EnvironmentConfigRevision;
};
