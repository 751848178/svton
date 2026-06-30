/**
 * SWR 请求 Hooks（对齐 picshare 范式）
 *
 * - useQuery：GET 数据获取，自动缓存、聚焦重验证、依赖刷新、条件请求。
 * - useMutation：POST/PUT/DELETE 提交，返回 trigger + isMutating。
 * - mutate：手动刷新指定缓存。
 *
 * 类型由 @/types/api-registry 的模块增强保证。
 */

import useSWR, { type SWRConfiguration, type SWRResponse } from 'swr';
import useSWRMutation, { type SWRMutationConfiguration } from 'swr/mutation';
import { mutate } from 'swr';
import type { ApiName, ApiParams, ApiResponse } from '@svton/api-client';
import '@/types/api-registry';
import { apiAsync, apiRequest } from '@/lib/api-client';

/** 生成 SWR 缓存 key；params 为 null 时返回 null（条件请求，不发请求）。 */
function generateKey<K extends ApiName>(apiName: K, params?: ApiParams<K> | null): string | null {
  if (params === undefined || params === null) return null;
  return JSON.stringify([apiName, params]);
}

/** SWR fetcher：从序列化 key 还原 apiName + params。 */
async function fetcher<K extends ApiName>(key: string): Promise<ApiResponse<K>> {
  const [apiName, params] = JSON.parse(key) as [K, ApiParams<K>];
  return (
    params !== undefined
      ? await (apiAsync as any)(apiName, params)
      : await (apiAsync as any)(apiName)
  ) as ApiResponse<K>;
}

/** 默认 SWR 配置：聚焦重验证、网络恢复重验证、2s 去重。 */
export const DEFAULT_SWR_CONFIG: SWRConfiguration = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
};

/**
 * useQuery —— 数据获取（GET）。
 *
 * 仅用于已登记到 GlobalApiRegistry 的端点。未登记端点用 `useQueryLoose`。
 *
 * @example
 * const { data, error, isLoading, mutate } = useQuery('GET:/teams');
 */
export function useQuery<K extends ApiName>(
  apiName: K,
  params?: ApiParams<K> | null,
  config?: SWRConfiguration<ApiResponse<K>>,
): SWRResponse<ApiResponse<K>> {
  const key = generateKey(apiName, params as ApiParams<K>);
  return useSWR<ApiResponse<K>>(key, fetcher<K>, { ...DEFAULT_SWR_CONFIG, ...config });
}

/**
 * useQueryLoose —— 宽松版数据获取（GET）。
 *
 * 用于尚未登记到 GlobalApiRegistry 的端点。接受任意 `METHOD:/path` 字符串，
 * 用泛型显式声明响应类型。支持 `fallback`（首屏 server 数据透传，避免 client 二次请求）。
 *
 * @example
 * // page.tsx (server)
 * export default async function Page() {
 *   const initialKeys = await serverRequest<Key[]>('GET:/keys');
 *   return <KeysView initialKeys={initialKeys} />;
 * }
 * // KeysView (client)
 * const { data } = useQueryLoose<Key[]>('GET:/keys', { fallback: initialKeys });
 */
export function useQueryLoose<T>(
  apiName: string,
  config?: SWRConfiguration<T>,
): SWRResponse<T> {
  const key = apiName;
  return useSWR<T>(
    key,
    async () => (await (apiRequest as (n: string) => Promise<T>)(apiName)) as T,
    { ...DEFAULT_SWR_CONFIG, ...config },
  );
}

/**
 * useMutation —— 数据提交（POST/PUT/DELETE）。
 *
 * @example
 * const { trigger, isMutating } = useMutation('POST:/teams');
 * await trigger({ name, description });
 */
export function useMutation<K extends ApiName>(
  apiName: K,
  config?: SWRMutationConfiguration<ApiResponse<K>, Error, string, ApiParams<K>>,
) {
  return useSWRMutation<ApiResponse<K>, Error, string, ApiParams<K>>(
    apiName as string,
    async (_key, { arg }) => {
      return (
        arg !== undefined ? await (apiAsync as any)(apiName, arg) : await (apiAsync as any)(apiName)
      ) as ApiResponse<K>;
    },
    config,
  );
}

export { mutate };
export type { SWRConfiguration, SWRResponse };
