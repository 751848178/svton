export type ProjectDirectoryStatus = 'online' | 'needs_configuration';
export type ProjectDirectoryStatusFilter = 'all' | ProjectDirectoryStatus;

export interface ProjectDirectoryActivity {
  id: string;
  type: 'analysis' | 'deployment' | 'release' | 'audit' | 'intake' | 'project';
  status: string;
  summary: string | null;
  occurredAt: string;
}

export interface ProjectDirectoryEnvironment {
  id: string;
  key: string;
  name: string;
  ready: boolean;
}

export interface ProjectDirectoryItem {
  id: string;
  name: string;
  status: ProjectDirectoryStatus;
  repository: {
    provider: string;
    canonicalUrl: string;
  } | null;
  intake: {
    projectType: string | null;
    architecture: string | null;
    componentCount: number | null;
  };
  baselines: {
    staging: ProjectDirectoryEnvironment | null;
    production: ProjectDirectoryEnvironment | null;
  };
  production: {
    currentVersion: string | null;
    domain: string | null;
  };
  activity: ProjectDirectoryActivity;
  checkpoints: ProjectDirectoryCheckpoint[];
  nextAction: { kind: string; href: string } | null;
}

export interface ProjectDirectoryCheckpoint {
  id: 'intake' | 'baseline_topology' | 'services' | 'config' | 'targets' | 'routes' | 'release';
  scope: 'project' | 'staging' | 'production';
  status: 'ready' | 'action_required' | 'blocked' | 'not_applicable';
  reasonCodes: string[];
  evidenceRefs: string[];
  action: { kind: string; href: string } | null;
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
