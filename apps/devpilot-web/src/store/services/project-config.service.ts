/**
 * 项目生成向导配置 Service
 *
 * 单一职责：管理项目向导的多步配置状态机（基本信息、子项目、功能、资源、环境等）。
 * 纯前端状态，无后端请求；持久化到 localStorage（向导刷新后可恢复）。
 */

import { Service, observable, action } from '@svton/service';
import {
  createProjectConfigTypes,
  type ProjectConfig,
  type ProjectResourceConfig,
} from './project-config.types';

const STORAGE_KEY = 'project-config-storage';

function loadPersisted(): ProjectConfig | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const { state } = JSON.parse(raw) as { state?: ProjectConfig };
    return state ?? null;
  } catch {
    return null;
  }
}

function persist(config: ProjectConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: config, version: 0 }));
}

@Service()
export class ProjectConfigService {
  @observable() config: ProjectConfig;
  @observable() currentStep = 0;

  constructor() {
    this.config = loadPersisted() ?? createProjectConfigTypes().initialConfig;
  }

  private commit(): void {
    persist(this.config);
  }

  @action() setBasicInfo(info: Partial<ProjectConfig['basicInfo']>): void {
    this.config = { ...this.config, basicInfo: { ...this.config.basicInfo, ...info } };
    this.commit();
  }

  @action() setSubProjects(sub: Partial<ProjectConfig['subProjects']>): void {
    this.config = { ...this.config, subProjects: { ...this.config.subProjects, ...sub } };
    this.commit();
  }

  @action() toggleFeature(featureId: string): void {
    const has = this.config.features.includes(featureId);
    const features = has
      ? this.config.features.filter((id) => id !== featureId)
      : [...this.config.features, featureId];
    this.config = { ...this.config, features };
    this.commit();
  }

  @action() setFeatures(features: string[]): void {
    this.config = { ...this.config, features };
    this.commit();
  }

  @action() setResource(type: string, resource: ProjectResourceConfig | null): void {
    const resources = resource
      ? { ...this.config.resources, [type]: resource }
      : Object.fromEntries(Object.entries(this.config.resources).filter(([t]) => t !== type));
    this.config = { ...this.config, resources };
    this.commit();
  }

  @action() setResources(resources: Record<string, ProjectResourceConfig>): void {
    this.config = { ...this.config, resources };
    this.commit();
  }

  @action() setDatabase(database: Partial<ProjectConfig['database']>): void {
    this.config = {
      ...this.config,
      database: { ...this.config.database, ...database },
    };
    this.commit();
  }

  @action() setUiLibrary(lib: Partial<ProjectConfig['uiLibrary']>): void {
    this.config = { ...this.config, uiLibrary: { ...this.config.uiLibrary, ...lib } };
    this.commit();
  }

  @action() setHooks(enabled: boolean): void {
    this.config = { ...this.config, hooks: enabled };
    this.commit();
  }

  @action() setGitConfig(gitConfig: ProjectConfig['gitConfig']): void {
    this.config = { ...this.config, gitConfig };
    this.commit();
  }

  @action() setCurrentStep(step: number): void {
    this.currentStep = step;
  }

  @action() reset(): void {
    this.config = createProjectConfigTypes().initialConfig;
    this.currentStep = 0;
    this.commit();
  }

  @action() loadPreset(config: ProjectConfig): void {
    this.config = config;
    this.currentStep = 0;
    this.commit();
  }
}
