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

export interface ProjectDirectoryEnvironmentVersionColumn {
  id: string;
  key: string;
  name: string;
  baselineRole: string | null;
  /** 该环境当前生效的发布版本号（无版本为 null）。 */
  currentVersion: string | null;
  /** 当前版本生效时间（ISO，无版本为 null）。 */
  currentVersionEffectiveAt: string | null;
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
  /** 项目全部环境及其当前版本（驱动列表页动态环境列）。 */
  environments: ProjectDirectoryEnvironmentVersionColumn[];
  /** 项目组件（名称 + 首个端口），驱动列表页「组件」列。 */
  components: Array<{ name: string; port: number | null }>;
  /** 最近一次发布时间：各环境当前版本生效时间的最大值（ISO，从未发布为 null）。 */
  latestReleaseAt: string | null;
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
