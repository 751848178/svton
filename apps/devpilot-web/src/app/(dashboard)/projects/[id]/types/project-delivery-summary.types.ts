export type ProjectDeliveryBaselineRole = 'staging' | 'production';

export interface ProjectDeliverySummary {
  version: 1;
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
  resources: { bound: number; total: number };
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
}
