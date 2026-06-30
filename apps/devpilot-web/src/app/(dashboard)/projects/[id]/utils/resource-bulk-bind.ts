/**
 * 项目详情域 - 资源批量绑定工具
 *
 * 单一职责：资源批量绑定选择状态的构建、切换、计数、请求构造（纯函数）。
 */

import type { Project } from '../types';
import type {
  EnvironmentResourceBulkBindSelection,
  EnvironmentResourceBulkBindSelectionKey,
  EnvironmentResourceBulkBindType,
} from '../types/environment-copy';

const resourceBulkBindTypeBySelectionKey: Record<
  EnvironmentResourceBulkBindSelectionKey,
  EnvironmentResourceBulkBindType
> = {
  managedResourceIds: 'managed_resource',
  resourceInstanceIds: 'resource_instance',
  siteIds: 'site',
  cdnConfigIds: 'cdn_config',
  secretKeyIds: 'secret_key',
};

export function createEmptyResourceBulkBindSelection(): EnvironmentResourceBulkBindSelection {
  return {
    managedResourceIds: [],
    resourceInstanceIds: [],
    siteIds: [],
    cdnConfigIds: [],
    secretKeyIds: [],
  };
}

export function createResourceBulkBindSelection(
  project: Project,
): EnvironmentResourceBulkBindSelection {
  return {
    managedResourceIds: (project.managedResources || [])
      .filter((r) => !r.environment?.id)
      .map((r) => r.id),
    resourceInstanceIds: (project.resourceInstances || [])
      .filter((i) => !i.projectEnvironment?.id)
      .map((i) => i.id),
    siteIds: (project.sites || []).filter((s) => !s.environment?.id).map((s) => s.id),
    cdnConfigIds: (project.cdnConfigs || []).filter((c) => !c.environment?.id).map((c) => c.id),
    secretKeyIds: (project.secretKeys || []).filter((s) => !s.environment?.id).map((s) => s.id),
  };
}

export function countResourceBulkBindSelection(
  selection: EnvironmentResourceBulkBindSelection,
): number {
  return Object.values(selection).reduce((total, ids) => total + ids.length, 0);
}

export function toggleResourceBulkBindSelection(
  selection: EnvironmentResourceBulkBindSelection,
  key: EnvironmentResourceBulkBindSelectionKey,
  resourceId: string,
  selected: boolean,
): EnvironmentResourceBulkBindSelection {
  const currentIds = selection[key];
  const nextIds = selected
    ? Array.from(new Set([...currentIds, resourceId]))
    : currentIds.filter((id) => id !== resourceId);
  return { ...selection, [key]: nextIds };
}

export function buildResourceBulkBindRequest(selection: EnvironmentResourceBulkBindSelection) {
  const resourceIds = createEmptyResourceBulkBindSelection();
  const resourceTypes: EnvironmentResourceBulkBindType[] = [];
  (
    Object.keys(resourceBulkBindTypeBySelectionKey) as EnvironmentResourceBulkBindSelectionKey[]
  ).forEach((key) => {
    const selectedIds = selection[key];
    if (selectedIds.length > 0) {
      resourceTypes.push(resourceBulkBindTypeBySelectionKey[key]);
      resourceIds[key] = selectedIds;
    }
  });
  return { resourceTypes, resourceIds };
}
