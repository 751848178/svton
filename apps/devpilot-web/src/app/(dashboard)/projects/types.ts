export type ProjectRuntimeStatus = 'idle' | 'running' | 'failed';
export type ProjectConfigurationStatus = 'draft' | 'in_progress' | 'ready' | 'needs_configuration';

export interface ProjectDirectoryActivity {
  id: string;
  type: 'analysis' | 'deployment' | 'release' | 'audit';
  status: string;
  summary: string | null;
  occurredAt: string;
}

export interface ProjectDirectoryEnvironment {
  id: string;
  key: string;
  name: string;
  status: string;
  baselineRole: string | null;
  identityLockedAt: string | null;
  currentConfigRevisionId: string | null;
}

export interface ProjectDirectoryItem {
  id: string;
  name: string;
  description: string | null;
  onboardingStatus: string | null;
  runtimeStatus: ProjectRuntimeStatus;
  configurationStatus: ProjectConfigurationStatus;
  repository: {
    provider: string;
    canonicalUrl: string | null;
    defaultBranch: string | null;
    commitSha: string | null;
    status: string;
  } | null;
  baselines: {
    staging: ProjectDirectoryEnvironment | null;
    production: ProjectDirectoryEnvironment | null;
  };
  production: {
    environmentId: string;
    currentVersion: string | null;
    latestDeployment: {
      id: string;
      status: string;
      dryRun: boolean;
      commitSha: string | null;
      startedAt: string;
      finishedAt: string | null;
    } | null;
  } | null;
  domains: Array<{ domain: string; status: string; source: 'site' | 'proxy' }>;
  activity: ProjectDirectoryActivity[];
  counts: { applications: number; applicationServices: number };
  createdBy: { id: string; name: string | null; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDirectoryResponse {
  items: ProjectDirectoryItem[];
  total: number;
  summary: {
    total: number;
    online: number;
    needsConfiguration: number;
  };
}

export type ProjectRuntimeFilter = 'all' | ProjectRuntimeStatus;
export type ProjectConfigurationFilter = 'all' | ProjectConfigurationStatus;
