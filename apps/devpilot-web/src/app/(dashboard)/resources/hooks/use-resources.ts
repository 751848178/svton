/**
 * 资源凭证数据 Hook
 *
 * 单一职责：资源列表与资源类型的获取、新增、删除。
 *
 * 列表走 SWR（useQueryLoose，双端点），支持 initialResources/initialResourceTypes
 * （首屏 server 数据透传）。写操作后调用 mutate 刷新缓存。
 */

import { useMemo } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { useQueryLoose, mutate } from '@/hooks/api/use-api';
import type { Resource, ResourceType, ResourceInput } from '../types';

const RESOURCES_KEY = 'GET:/resources';
const RESOURCE_TYPES_KEY = 'GET:/registry/resource-types';
const EMPTY_RESOURCES: Resource[] = [];
const EMPTY_RESOURCE_TYPES: ResourceType[] = [];

export function useResources(initialResources?: Resource[], initialResourceTypes?: ResourceType[]) {
  const {
    data: resourcesData,
    error: resourcesError,
    isLoading: resourcesLoading,
  } = useQueryLoose<Resource[]>(RESOURCES_KEY, { fallback: initialResources });
  const { data: resourceTypesData } = useQueryLoose<ResourceType[]>(RESOURCE_TYPES_KEY, {
    fallback: initialResourceTypes,
  });

  const resources = resourcesData ?? EMPTY_RESOURCES;
  const resourceTypes = resourceTypesData ?? EMPTY_RESOURCE_TYPES;
  const isLoading = resourcesLoading;

  const resourceTypeMap = useMemo(
    () => Object.fromEntries(resourceTypes.map((t) => [t.id, t])),
    [resourceTypes],
  );

  const create = usePersistFn(async (input: ResourceInput) => {
    await apiRequest('POST:/resources', input);
    await mutate(RESOURCES_KEY);
  });

  const remove = usePersistFn(async (id: string) => {
    await apiRequest(`DELETE:/resources/${id}`);
    await mutate(RESOURCES_KEY);
  });

  return { resources, resourceTypes, resourceTypeMap, isLoading, loadError: resourcesError, create, remove };
}
