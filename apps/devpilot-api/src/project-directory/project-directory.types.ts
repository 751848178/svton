export type ProjectDirectoryStatus = "online" | "needs_configuration";

export type ProjectDirectoryActivityType =
  | "analysis"
  | "deployment"
  | "release"
  | "audit"
  | "intake"
  | "project";

export interface ProjectDirectoryActivity {
  id: string;
  type: ProjectDirectoryActivityType;
  status: string;
  summary: string | null;
  occurredAt: string;
}

export interface ProjectDirectoryEnvironmentSummary {
  id: string;
  key: string;
  name: string;
  ready: boolean;
}

export interface ProjectDirectoryIntakeSummary {
  projectType: string | null;
  architecture: string | null;
  componentCount: number | null;
}

export interface ProjectDirectoryItem {
  id: string;
  name: string;
  status: ProjectDirectoryStatus;
  repository: {
    provider: string;
    canonicalUrl: string;
  } | null;
  intake: ProjectDirectoryIntakeSummary;
  baselines: {
    staging: ProjectDirectoryEnvironmentSummary | null;
    production: ProjectDirectoryEnvironmentSummary | null;
  };
  production: {
    currentVersion: string | null;
    domain: string | null;
  };
  activity: ProjectDirectoryActivity;
  checkpoints: import("../release-delivery/project-delivery-summary.types").ProjectDeliveryCheckpoint[];
  nextAction: import("../release-delivery/project-delivery-summary.types").ProjectDeliveryAction | null;
}

export interface ProjectDirectoryResponse {
  scope: {
    teamId: string;
    actorId: string;
  };
  items: ProjectDirectoryItem[];
  total: number;
  summary: {
    total: number;
    online: number;
    needsConfiguration: number;
  };
}
