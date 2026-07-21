/**
 * 资源实例数据 Hook
 *
 * 单一职责：资源实例列表获取 + 释放动作。
 *
 * 列表走 SWR（useQueryLoose），支持 initialInstances（首屏 server 数据透传，避免 client 二次请求）；
 * 释放后调用 mutate 刷新缓存。
 */

import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { useQueryLoose, mutate } from '@/hooks/api/use-api';
import type { ResourceInstance } from '../types';

/** SWR 缓存 key（与 useQueryLoose 的 apiName 一致）。 */
const RESOURCE_INSTANCES_KEY = 'GET:/resource-instances';

export function useResourceInstances(initialInstances?: ResourceInstance[] | undefined) {
  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useQueryLoose<ResourceInstance[]>(RESOURCE_INSTANCES_KEY, { fallback: initialInstances });
  const instances = data ?? [];

  const release = usePersistFn(async (id: string) => {
    await apiRequest(`POST:/resource-instances/${id}/release`);
    await mutate(RESOURCE_INSTANCES_KEY);
  });

  return { instances, loading: isLoading, loadError: error, release, refresh };
}
