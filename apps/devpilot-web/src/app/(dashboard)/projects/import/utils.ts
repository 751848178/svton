/**
 * 项目接入域工具函数
 *
 * 单一职责：配置对象构建（技术栈、部署、来源）。
 */

import type { ProjectManagementScope } from '@/lib/project-display';
import type { ImportProjectForm, OnboardingOrigin } from './types';

export function trimmed(value: string): string | undefined {
  const next = value.trim();
  return next ? next : undefined;
}

/** 构建技术栈配置（language/framework/packageManager）。 */
export function buildStackProfile(form: ImportProjectForm): Record<string, string> {
  return Object.fromEntries(
    [
      ['language', trimmed(form.language)],
      ['framework', trimmed(form.framework)],
      ['packageManager', trimmed(form.packageManager)],
    ].filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

/** 按管理范围推导接入来源。 */
export function getOriginForScope(scope: ProjectManagementScope): OnboardingOrigin {
  return scope === 'resources' ? 'external' : 'imported';
}

/** 构建部署配置。 */
export function buildDeploymentConfig(form: ImportProjectForm): Record<string, string | boolean> {
  return Object.fromEntries(
    [
      ['enabled', form.managementScope === 'full' || form.managementScope === 'deployment'],
      ['targetType', form.deploymentTarget],
      ['workingDirectory', trimmed(form.workingDirectory)],
      ['buildCommand', trimmed(form.buildCommand)],
      ['deployCommand', trimmed(form.deployCommand)],
      ['healthCheckUrl', trimmed(form.healthCheckUrl)],
    ].filter((entry): entry is [string, string | boolean] => entry[1] !== undefined),
  );
}

/** 根据表单构建完整项目 config 对象。 */
export function buildProjectConfig(form: ImportProjectForm, name: string): Record<string, unknown> {
  const gitRepo = trimmed(form.gitRepo);
  const stackProfile = buildStackProfile(form);
  const origin = getOriginForScope(form.managementScope);
  const config: Record<string, unknown> = {
    origin,
    mode: origin,
    managementScope: form.managementScope,
    projectName: name,
    description: trimmed(form.description),
    initialized: false,
    environments: form.environments,
    source: {
      type: origin === 'imported' ? (gitRepo ? 'git' : 'manual') : 'external',
      provider: trimmed(form.provider),
      repository: gitRepo,
      branch: trimmed(form.branch),
    },
    onboarding: {
      status: 'connected',
      initializer: 'skipped',
      scope: form.managementScope,
      connectedAt: new Date().toISOString(),
    },
  };
  if (Object.keys(stackProfile).length > 0) config.stackProfile = stackProfile;
  if (form.managementScope !== 'resources') config.deployment = buildDeploymentConfig(form);
  return config;
}
