import type { ResourceReferenceKind } from "../project-environment/environment-config-revision.types";

export interface ReleaseDeploymentInputSnapshot {
  version: 1;
  configRevision: {
    id: string;
    revision: number;
    snapshotHash: string;
    stateHash: string;
  };
  routeTargets: Array<{
    serviceId: string;
    component: string;
    port: number;
  }>;
  plainVariableKeys: string[];
  secretReferences: Array<{
    id: string;
    name: string;
    type: string;
    versionHash: string;
    targetEnvKey: string;
  }>;
  resourceReferences: Array<{
    id: string;
    kind: string;
    name: string;
    status: string;
    environmentId: string | null;
    sharedEnvironmentIds: string[];
    versionHash: string;
    componentKey: string;
    envBindings: Array<{ sourceKey: string; targetEnvKey: string }>;
    environmentKeys: string[];
  }>;
  target: {
    bindingId: string;
    serverId: string;
    providerKey: string;
    targetRef: string;
    versionHash: string;
  };
  runtimeEnvironmentKeys: string[];
  globalEnvironmentKeys: string[];
  componentEnvironmentKeys: Record<string, string[]>;
  inputHash: string;
}

export interface ReleaseDeploymentTargetConnection {
  host: string;
  port: number;
  username: string;
  authType: string;
  credential: string;
  root: string;
}

export interface PreparedReleaseDeploymentInput {
  snapshot: ReleaseDeploymentInputSnapshot;
  globalEnvironment: Record<string, string>;
  componentEnvironments: Record<string, Record<string, string>>;
  targetConnection?: ReleaseDeploymentTargetConnection;
}

export interface ReleaseDeploymentResourceState {
  id: string;
  kind: ResourceReferenceKind;
  name: string;
  status: string;
  environmentId: string | null;
  sharedEnvironmentIds: string[];
  componentKey?: string;
  envBindings?: Array<{ sourceKey: string; targetEnvKey: string }>;
  updatedAt: Date | null;
  runtime?: {
    delivery: unknown;
    credentials: string | null;
    envTemplate: string | null;
  };
}

export interface ReleaseDeploymentInputState {
  environmentId: string;
  revision: {
    id: string;
    revision: number;
    snapshotHash: string;
    plainVariables: unknown;
    secretReferences: unknown;
    resourceReferences: unknown;
    routeSnapshot?: unknown;
  };
  secrets: Array<{
    id: string;
    name: string;
    type: string;
    value: string;
    updatedAt: Date;
    targetEnvKey?: string;
  }>;
  resources: ReleaseDeploymentResourceState[];
  bindings: Array<{
    id: string;
    metadata: unknown;
    updatedAt: Date;
    server: {
      id: string;
      host: string;
      port: number;
      username: string;
      authType: string;
      credentials: string;
      status: string;
      updatedAt: Date;
    };
  }>;
}
