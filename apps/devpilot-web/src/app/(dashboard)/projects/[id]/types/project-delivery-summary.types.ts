export type ProjectDeliveryBaselineRole = 'staging' | 'production';

export interface ProjectDeliverySummary {
  version: 2;
  scope: { teamId: string; actorId: string; projectId: string };
  project: { id: string; name: string };
  repository: {
    provider: string;
    canonicalUrl: string;
    defaultBranch: string;
  } | null;
  intake: {
    projectType: string | null;
    architecture: string | null;
    componentCount: number | null;
  };
  baselines: Record<
    ProjectDeliveryBaselineRole,
    { id: string; key: string; name: string; ready: boolean } | null
  >;
  resources: {
    bound: number;
    total: number;
    byEnvironment: Record<ProjectDeliveryBaselineRole, number>;
  };
  entries: {
    active: number;
    total: number;
    unit: 'site';
    productionDomain: string | null;
  };
  currentVersions: Record<
    ProjectDeliveryBaselineRole,
    {
      id: string;
      releaseOrderId: string;
      releaseVersion: string;
      artifactManifestId: string;
      manifestDigest: string;
      deploymentRunId: string;
      effectiveAt: string;
    } | null
  >;
  checkpoints: ProjectDeliveryCheckpoint[];
  nextAction: { kind: string; href: string } | null;
}

export interface ProjectDeliveryCheckpoint {
  id: 'intake' | 'baseline_topology' | 'services' | 'config' | 'targets' | 'routes' | 'release';
  scope: ProjectDeliveryBaselineRole | 'project';
  status: 'ready' | 'action_required' | 'blocked' | 'not_applicable';
  reasonCodes: string[];
  evidenceRefs: string[];
  action: { kind: string; href: string } | null;
}
