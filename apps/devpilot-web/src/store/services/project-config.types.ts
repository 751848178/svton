/**
 * 项目向导配置类型与初始值
 *
 * 单一职责：仅声明类型与默认配置，不含任何逻辑。
 */

export type SubProjectType = 'backend' | 'admin' | 'mobile';
export type ProjectEnvironmentKey = 'dev' | 'test' | 'staging' | 'prod';
export type DatabaseEngine = 'mysql' | 'postgresql' | 'sqlite';
export type ResourceConfigMode = 'manual' | 'credential' | 'instance' | 'pool' | 'skipped';

export interface ProjectResourceConfig {
  type: string;
  mode: ResourceConfigMode;
  config?: Record<string, string>;
  credentialId?: string;
  instanceId?: string;
  poolId?: string;
  resourceName?: string;
}

export interface ProjectConfig {
  basicInfo: {
    name: string;
    orgName: string;
    description: string;
    packageManager: 'pnpm' | 'npm' | 'yarn';
  };
  subProjects: {
    backend: boolean;
    admin: boolean;
    mobile: boolean;
  };
  features: string[];
  resources: Record<string, ProjectResourceConfig>;
  environments: ProjectEnvironmentKey[];
  database: { engine: DatabaseEngine };
  uiLibrary: { admin: boolean; mobile: boolean };
  hooks: boolean;
  gitConfig?: {
    provider: 'github' | 'gitlab' | 'gitee';
    repoName: string;
    visibility: 'public' | 'private';
    createNew: boolean;
  };
}

export function createProjectConfigTypes(): { initialConfig: ProjectConfig } {
  return {
    initialConfig: {
      basicInfo: { name: '', orgName: '', description: '', packageManager: 'pnpm' },
      subProjects: { backend: true, admin: false, mobile: false },
      features: [],
      resources: {},
      environments: ['dev', 'test', 'staging', 'prod'],
      database: { engine: 'mysql' },
      uiLibrary: { admin: false, mobile: false },
      hooks: false,
    },
  };
}
