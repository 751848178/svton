export interface ReleaseDeploymentInputSnapshot {
  version: 1;
  configRevision: {
    id: string;
    revision: number;
    snapshotHash: string;
    stateHash: string;
  };
  plainVariableKeys: string[];
  secretReferences: Array<{
    id: string;
    name: string;
    type: string;
    versionHash: string;
  }>;
  resourceReferences: Array<{
    id: string;
    kind: string;
    name: string;
    status: string;
    environmentId: string | null;
    sharedEnvironmentIds: string[];
    versionHash: string;
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
  runtimeEnvironment: Record<string, string>;
  targetConnection?: ReleaseDeploymentTargetConnection;
}

export interface ReleaseDeploymentResourceState {
  id: string;
  kind: string;
  name: string;
  status: string;
  environmentId: string | null;
  sharedEnvironmentIds: string[];
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
  };
  secrets: Array<{
    id: string;
    name: string;
    type: string;
    value: string;
    updatedAt: Date;
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
      updatedAt: Date;
    };
  }>;
}
