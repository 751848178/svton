export type ReferencedResource = {
  kind: string;
  id: string;
  projectId: string | null;
  environmentId: string | null;
  status: string;
  observedAt: Date | null;
  resourceKind?: string;
};

export type ReleaseGateDeployEvidence = {
  environment: {
    id: string;
    key: string;
    status: string;
    baselineRole: string | null;
    currentConfigRevision: {
      id: string;
      projectId: string;
      environmentId: string;
      revision: number;
      snapshotHash: string;
      plainVariables: unknown;
      secretReferences: unknown;
      resourceReferences: unknown;
      routeSnapshot: unknown;
      policyReferences: unknown;
      createdAt: Date;
    } | null;
    serverBindings: Array<{
      id: string;
      status: string;
      updatedAt: Date;
      server: { id: string; status: string; updatedAt: Date };
    }>;
  } | null;
  secrets: Array<{
    id: string;
    projectId: string | null;
    environmentId: string | null;
    name: string;
    type: string;
    updatedAt: Date;
  }>;
  resources: ReferencedResource[];
  deployments: Array<{
    id: string;
    environmentId: string | null;
    status: string;
    dryRun: boolean;
    targetType: string;
    artifactManifestId: string | null;
    finishedAt: Date | null;
    createdAt: Date;
  }>;
  connections: Array<{
    id: string;
    resourceId: string;
    environmentId: string | null;
    status: string;
    dryRun: boolean;
    finishedAt: Date | null;
    createdAt: Date;
  }>;
  metrics: Array<{
    id: string;
    resourceId: string;
    environmentId: string | null;
    status: string;
    sampledAt: Date;
    raw: unknown;
  }>;
  backups: Array<{
    id: string;
    resourceId: string;
    environmentId: string | null;
    status: string;
    dryRun: boolean;
    finishedAt: Date | null;
    createdAt: Date;
  }>;
};
