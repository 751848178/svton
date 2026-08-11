import type { RepositoryIntakeSummary } from "../project-intake/repository-intake-summary.types";

export type ProjectDeliveryBaselineRole = "staging" | "production";

export interface ProjectDeliveryBaselineSummary {
  id: string;
  key: string;
  name: string;
  ready: boolean;
}

export interface ProjectDeliveryCurrentVersionSummary {
  id: string;
  releaseOrderId: string;
  releaseVersion: string;
  artifactManifestId: string;
  manifestDigest: string;
  deploymentRunId: string;
  effectiveAt: string;
}

export interface ProjectDeliverySummaryResponse {
  version: 2;
  scope: { teamId: string; actorId: string; projectId: string };
  project: { id: string; name: string };
  repository: {
    provider: string;
    canonicalUrl: string;
    defaultBranch: string;
  } | null;
  intake: RepositoryIntakeSummary;
  baselines: Record<
    ProjectDeliveryBaselineRole,
    ProjectDeliveryBaselineSummary | null
  >;
  resources: {
    bound: number;
    total: number;
    byEnvironment: Record<ProjectDeliveryBaselineRole, number>;
  };
  entries: {
    active: number;
    total: number;
    unit: "site";
    productionDomain: string | null;
  };
  currentVersions: Record<
    ProjectDeliveryBaselineRole,
    ProjectDeliveryCurrentVersionSummary | null
  >;
  checkpoints: ProjectDeliveryCheckpoint[];
  nextAction: ProjectDeliveryAction | null;
}

export type ProjectDeliveryCheckpointStatus =
  | "ready"
  | "action_required"
  | "blocked"
  | "not_applicable";

export interface ProjectDeliveryAction {
  kind: string;
  href: string;
}

export interface ProjectDeliveryCheckpoint {
  id:
    | "intake"
    | "baseline_topology"
    | "services"
    | "config"
    | "targets"
    | "routes"
    | "release";
  scope: ProjectDeliveryBaselineRole | "project";
  status: ProjectDeliveryCheckpointStatus;
  reasonCodes: string[];
  evidenceRefs: string[];
  action: ProjectDeliveryAction | null;
}
