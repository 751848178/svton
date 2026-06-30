/**
 * 密钥中心数据 Hook
 *
 * 单一职责：密钥列表、生成、存储、查看明文、删除。
 *
 * 列表走 SWR（useQueryLoose），支持 initialData（首屏 server 数据透传，避免 client 二次请求）；
 * 写操作后调用 mutate 刷新缓存。
 */

import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { useQueryLoose, mutate } from '@/hooks/api/use-api';
import type { SecretKey, KeyInput, GenerateKeyInput } from '../types';

/** SWR 缓存 key（与 useQueryLoose 的 apiName 一致）。 */
const KEYS_KEY = 'GET:/keys';

export function useKeys(initialKeys?: SecretKey[] | undefined) {
  const { data, isLoading, mutate: refresh } = useQueryLoose<SecretKey[]>(KEYS_KEY, {
    fallback: initialKeys,
  });
  const keys = data ?? [];

  const generate = usePersistFn(async (input: GenerateKeyInput) => {
    const result = await apiRequest<{ key: string; type: string }>('POST:/keys/generate', input);
    return result.key;
  });

  const store = usePersistFn(async (input: KeyInput) => {
    await apiRequest('POST:/keys', input);
    await mutate(KEYS_KEY);
  });

  const revealValue = usePersistFn(async (keyId: string) => {
    return apiRequest<string>(`GET:/keys/${keyId}/value`);
  });

  const remove = usePersistFn(async (id: string) => {
    await apiRequest(`DELETE:/keys/${id}`);
    await mutate(KEYS_KEY);
  });

  return { keys, loading: isLoading, generate, store, revealValue, remove, refresh };
}
