/**
 * 密钥中心数据 Hook
 *
 * 单一职责：密钥列表、生成、存储、查看明文、删除。
 *
 * 列表走 SWR（useQueryLoose），支持 initialData（首屏 server 数据透传，避免 client 二次请求）；
 * 写操作后调用 mutate 刷新缓存。
 *
 * scope（projectId/environmentId）会拼到 GET /keys 的查询串，并进入 SWR cache key，
 * 使不同作用域的列表互不串味；store 写入时透传 scope 以绑定到当前项目/环境。
 */

import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { useQueryLoose, mutate } from '@/hooks/api/use-api';
import type { SecretKey, KeyInput, GenerateKeyInput, KeyScopeFilter } from '../types';

/** 由 scope 构造 GET /keys 的 apiName（含查询串）。 */
function buildKeysApiName(scope?: KeyScopeFilter): string {
  const { projectId, environmentId } = scope ?? {};
  if (!projectId && !environmentId) return 'GET:/keys';
  const qs = new URLSearchParams();
  if (projectId) qs.append('projectId', projectId);
  if (environmentId) qs.append('environmentId', environmentId);
  return `GET:/keys?${qs.toString()}`;
}

export function useKeys(scope?: KeyScopeFilter, initialKeys?: SecretKey[] | undefined) {
  const keysApiName = buildKeysApiName(scope);
  const { data, isLoading, error, mutate: refresh } = useQueryLoose<SecretKey[]>(keysApiName, {
    fallback: initialKeys,
  });
  const keys = data ?? [];

  const generate = usePersistFn(async (input: GenerateKeyInput) => {
    const result = await apiRequest<{ key: string; type: string }>('POST:/keys/generate', input);
    return result.key;
  });

  const store = usePersistFn(async (input: KeyInput) => {
    await apiRequest('POST:/keys', input);
    await mutate(keysApiName);
    // 作用域视图可能同时存在，刷新全局缓存兜底（未命中即 no-op）。
    if (keysApiName !== 'GET:/keys') await mutate('GET:/keys');
  });

  const revealValue = usePersistFn(async (keyId: string) => {
    return apiRequest<string>(`GET:/keys/${keyId}/value`);
  });

  const remove = usePersistFn(async (id: string) => {
    await apiRequest(`DELETE:/keys/${id}`);
    await mutate(keysApiName);
    if (keysApiName !== 'GET:/keys') await mutate('GET:/keys');
  });

  return { keys, loading: isLoading, error, generate, store, revealValue, remove, refresh };
}
