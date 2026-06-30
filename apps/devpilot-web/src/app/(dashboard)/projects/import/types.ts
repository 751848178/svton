/**
 * 项目接入域类型
 *
 * 单一职责：仅声明接口与表单初始值。
 */

import type { ProjectManagementScope, ProjectOrigin } from '@/lib/project-display';

export type OnboardingOrigin = Exclude<ProjectOrigin, 'generated'>;
export type DeploymentTarget = 'server' | 'docker-compose' | 'kubernetes' | 'external-ci';
export type EnvironmentKey = 'dev' | 'test' | 'staging' | 'prod';

export interface CreatedProject {
  id: string;
}

export interface ImportProjectForm {
  managementScope: ProjectManagementScope;
  name: string;
  description: string;
  gitRepo: string;
  branch: string;
  provider: string;
  language: string;
  framework: string;
  packageManager: string;
  deploymentTarget: DeploymentTarget;
  workingDirectory: string;
  buildCommand: string;
  deployCommand: string;
  healthCheckUrl: string;
  environments: EnvironmentKey[];
}

export interface EnvironmentOption {
  id: EnvironmentKey;
  label: string;
}

export const ENVIRONMENT_OPTIONS: EnvironmentOption[] = [
  { id: 'dev', label: '开发' },
  { id: 'test', label: '测试' },
  { id: 'staging', label: '预发' },
  { id: 'prod', label: '生产' },
];

export const DEFAULT_ENVIRONMENT_KEYS: EnvironmentKey[] = ENVIRONMENT_OPTIONS.map((o) => o.id);

export const INITIAL_FORM: ImportProjectForm = {
  managementScope: 'full',
  name: '',
  description: '',
  gitRepo: '',
  branch: 'main',
  provider: 'github',
  language: '',
  framework: '',
  packageManager: '',
  deploymentTarget: 'docker-compose',
  workingDirectory: '',
  buildCommand: '',
  deployCommand: '',
  healthCheckUrl: '',
  environments: DEFAULT_ENVIRONMENT_KEYS,
};
