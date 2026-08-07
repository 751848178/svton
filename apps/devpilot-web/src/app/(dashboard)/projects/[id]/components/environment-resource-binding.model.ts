/**
 * 资源绑定行模型（纯函数）
 *
 * 单一职责：把「当前不可变修订里的资源引用」与项目实际的资源行（托管资源/
 * 资源实例/站点/CDN）联接成 Demo 六列视图需要的行，并推导共享与隔离模式、
 * 绑定方式与逐行校验结论。组件层只能通过这里的函数取值。
 */

import type { Project, ProjectEnvironment, ProjectManagedResource, ProjectResourceInstance, ProjectSite, ProjectCdnConfig } from '../types';
import type { EnvironmentConfigResourceReference } from '../types/environment-config-revision.types';

export type BindingMethod = 'bind-existing' | 'rebind' | 'unbind' | 'use-shared';
export type SharingMode = 'dedicated' | 'shared' | 'production-forced';
export type ResourceValidationState = 'valid' | 'missing' | 'out-of-scope' | 'forbidden';

export type ResourceBindingRow = {
  key: string;
  reference: EnvironmentConfigResourceReference;
  /** 资源需求：实例名（缺失时退回引用名）。 */
  requirement: string;
  /** 来源组件：引用上的影响说明（模型暂无组件关联字段，诚实映射）。 */
  source: string;
  /** 资源实例列：实例名或「—」。 */
  instanceName: string | null;
  /** 生命周期状态（ResourceInstance.status / ManagedResource.status 等）。 */
  lifecycleStatus: string | null;
  /** 托管资源真实健康字段（ManagedResource.status/endpoint/lastSyncAt）。 */
  managedHealth: {
    status: string;
    endpoint: string | null;
    lastSyncAt: string | null;
  } | null;
  sharingMode: SharingMode;
  bindingMethod: BindingMethod;
  validation: ResourceValidationState;
};

export function isProductionEnvironment(env: Pick<ProjectEnvironment, 'baselineRole'>): boolean {
  return env.baselineRole === 'production';
}

export function resourceSharingMode(
  env: Pick<ProjectEnvironment, 'baselineRole'>,
  reference: EnvironmentConfigResourceReference,
): SharingMode {
  if (isProductionEnvironment(env)) return 'production-forced';
  return reference.sharedEnvironmentIds.length > 1 ? 'shared' : 'dedicated';
}

export function bindingMethodFor(
  env: Pick<ProjectEnvironment, 'baselineRole'>,
  reference: EnvironmentConfigResourceReference,
): BindingMethod {
  return resourceSharingMode(env, reference) === 'shared' ? 'use-shared' : 'bind-existing';
}

function findInstance(project: Project, reference: EnvironmentConfigResourceReference) {
  switch (reference.kind) {
    case 'managed_resource':
      return (project.managedResources ?? []).find((item) => item.id === reference.id) ?? null;
    case 'resource_instance':
      return (project.resourceInstances ?? []).find((item) => item.id === reference.id) ?? null;
    case 'site':
      return (project.sites ?? []).find((item) => item.id === reference.id) ?? null;
    case 'cdn_config':
      return (project.cdnConfigs ?? []).find((item) => item.id === reference.id) ?? null;
  }
}

function owningEnvironmentId(instance: unknown): string | null {
  const row = instance as {
    environmentId?: string | null;
    environment?: { id: string | null } | null;
    projectEnvironment?: { id: string | null } | null;
  };
  return row.environmentId ?? row.environment?.id ?? row.projectEnvironment?.id ?? null;
}

function validate(
  env: Pick<ProjectEnvironment, 'baselineRole'>,
  reference: EnvironmentConfigResourceReference,
  instance: unknown,
): ResourceValidationState {
  if (isProductionEnvironment(env) && reference.sharedEnvironmentIds.length > 1) return 'forbidden';
  if (!instance) return 'missing';
  const environmentId = owningEnvironmentId(instance);
  if (environmentId && !reference.sharedEnvironmentIds.includes(environmentId)) return 'out-of-scope';
  return 'valid';
}

function lifecycleStatusOf(
  instance: ProjectManagedResource | ProjectResourceInstance | ProjectSite | ProjectCdnConfig | null,
): string | null {
  if (!instance) return null;
  return (instance as { status?: string }).status ?? null;
}

function managedHealthOf(
  instance: ProjectManagedResource | null,
): ResourceBindingRow['managedHealth'] {
  if (!instance) return null;
  return {
    status: instance.status,
    endpoint: instance.endpoint ?? null,
    lastSyncAt: instance.lastSyncAt ?? null,
  };
}

export function buildBindingRows(
  project: Project,
  environment: Pick<ProjectEnvironment, 'baselineRole'>,
  resources: EnvironmentConfigResourceReference[],
): ResourceBindingRow[] {
  return resources.map((reference) => {
    const instance = findInstance(project, reference);
    const validation = validate(environment, reference, instance);
    const managed = reference.kind === 'managed_resource'
      ? instance as ProjectManagedResource | null
      : null;
    return {
      key: `${reference.kind}:${reference.id}`,
      reference,
      requirement: instance?.name || reference.name || reference.id,
      source: reference.impact,
      instanceName: instance?.name ?? null,
      lifecycleStatus: lifecycleStatusOf(instance),
      managedHealth: managedHealthOf(managed),
      sharingMode: resourceSharingMode(environment, reference),
      bindingMethod: bindingMethodFor(environment, reference),
      validation,
    };
  });
}

/** 绑定方式列 / 编辑器共享：枚举展示标签（i18n key）。 */
export const BINDING_METHOD_LABEL_KEYS: Record<BindingMethod, string> = {
  'bind-existing': 'envResourceBindExisting',
  rebind: 'envResourceRebind',
  unbind: 'envResourceUnbind',
  'use-shared': 'envResourceUseShared',
};

export const SHARING_MODE_LABEL_KEYS: Record<SharingMode, string> = {
  dedicated: 'envResourceSharingDedicated',
  shared: 'envResourceSharingShared',
  'production-forced': 'envResourceSharingProductionForced',
};

export const VALIDATION_LABEL_KEYS: Record<ResourceValidationState, string> = {
  valid: 'envResourceValidationValid',
  missing: 'envResourceValidationMissing',
  'out-of-scope': 'envResourceValidationOutOfScope',
  forbidden: 'envResourceValidationForbidden',
};

/**
 * 草稿写回（AC-SET-026）：下面这些纯函数定义「绑定方式/共享与隔离」选择如何
 * 改写共享草稿；RowControls 只是它们的薄调用层，修订化保存统一提交。
 */

export function otherActiveNonProductionIds(
  project: Pick<Project, 'environments'>,
  environment: Pick<ProjectEnvironment, 'id'>,
): string[] {
  return (project.environments ?? [])
    .filter((item) => item.id !== environment.id && item.status !== 'archived' && item.baselineRole !== 'production')
    .map((item) => item.id);
}

export function candidatesOfKind(
  project: Project,
  kind: EnvironmentConfigResourceReference['kind'],
  exceptId: string,
): Array<{ id: string; name: string }> {
  const rows = (() => {
    switch (kind) {
      case 'managed_resource': return project.managedResources ?? [];
      case 'resource_instance': return project.resourceInstances ?? [];
      case 'site': return project.sites ?? [];
      case 'cdn_config': return project.cdnConfigs ?? [];
    }
  })();
  return rows
    .filter((item) => item.id !== exceptId)
    .map((item) => ({ id: item.id, name: item.name || item.id }));
}

export function applyBindingMethod(
  value: EnvironmentConfigResourceReference[],
  index: number,
  method: BindingMethod,
  environment: Pick<ProjectEnvironment, 'id' | 'baselineRole'>,
  project: Pick<Project, 'environments'>,
): EnvironmentConfigResourceReference[] {
  if (method === 'unbind') return value.filter((_, itemIndex) => itemIndex !== index);
  if (method === 'bind-existing') {
    return value.map((item, itemIndex) => itemIndex === index
      ? { ...item, sharedEnvironmentIds: [environment.id] }
      : item);
  }
  if (method === 'use-shared') {
    return applySharedScope(value, index, environment, project);
  }
  // rebind 展开实例选择器由 RowControls 本地状态处理后回调 applyRebind
  return value;
}

export function applySharingMode(
  value: EnvironmentConfigResourceReference[],
  index: number,
  mode: SharingMode,
  environment: Pick<ProjectEnvironment, 'id' | 'baselineRole'>,
  project: Pick<Project, 'environments'>,
): EnvironmentConfigResourceReference[] {
  if (mode === 'dedicated') {
    return value.map((item, itemIndex) => itemIndex === index
      ? { ...item, sharedEnvironmentIds: [environment.id] }
      : item);
  }
  if (mode === 'shared') return applySharedScope(value, index, environment, project);
  // production-forced 仅展示；生产环境由服务器强制环境专用
  return value;
}

function applySharedScope(
  value: EnvironmentConfigResourceReference[],
  index: number,
  environment: Pick<ProjectEnvironment, 'id' | 'baselineRole'>,
  project: Pick<Project, 'environments'>,
): EnvironmentConfigResourceReference[] {
  const item = value[index];
  const ids = item.sharedEnvironmentIds.length > 1
    ? item.sharedEnvironmentIds
    : [environment.id, ...otherActiveNonProductionIds(project, environment)];
  const unique = [...new Set(ids)].sort();
  return value.map((entry, itemIndex) => itemIndex === index
    ? {
        ...entry,
        sharedEnvironmentIds: unique,
        risk: unique.length > 1 && entry.risk === 'low' ? 'medium' : entry.risk,
      }
    : entry);
}

export function applySharedEnvironmentToggle(
  value: EnvironmentConfigResourceReference[],
  index: number,
  environmentId: string,
  checked: boolean,
): EnvironmentConfigResourceReference[] {
  const item = value[index];
  const ids = checked
    ? [...new Set([...item.sharedEnvironmentIds, environmentId])]
    : item.sharedEnvironmentIds.filter((id) => id !== environmentId);
  const unique = ids.sort();
  return value.map((entry, itemIndex) => itemIndex === index
    ? {
        ...entry,
        sharedEnvironmentIds: unique,
        risk: unique.length > 1 && entry.risk === 'low' ? 'medium' : entry.risk,
      }
    : entry);
}

export function applyRebind(
  value: EnvironmentConfigResourceReference[],
  index: number,
  candidate: { id: string; name: string },
): EnvironmentConfigResourceReference[] {
  return value.map((item, itemIndex) => itemIndex === index
    ? { ...item, id: candidate.id, name: candidate.name }
    : item);
}
