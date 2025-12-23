/**
 * Admin 端 useAPI Hook
 * 基于 SWR 提供高级功能：
 * - 自动缓存和重新验证
 * - 乐观更新
 * - 依赖刷新
 * - 条件请求
 * - 分页支持
 */

import useSWR, { type SWRConfiguration, type SWRResponse } from 'swr';
import useSWRInfinite, { type SWRInfiniteConfiguration } from 'swr/infinite';
import useSWRMutation, { type SWRMutationConfiguration } from 'swr/mutation';
import { apiAsync } from '@/lib/api-client';
import type { ApiName, ApiParams, ApiResponse } from '@svton/api-client';
// 引入类型定义以启用模块增强
import '@svton/types';

/**
 * 生成 SWR key
 */
function generateKey<K extends ApiName>(apiName: K, params?: ApiParams<K>): string | null {
  if (params === undefined || params === null) {
    return null; // 条件请求：params 为空时不发起请求
  }
  return JSON.stringify([apiName, params]);
}

/**
 * SWR fetcher
 */
async function fetcher<K extends ApiName>(key: string): Promise<ApiResponse<K>> {
  const [apiName, params] = JSON.parse(key);
  return (
    params !== undefined
      ? await (apiAsync as any)(apiName, params)
      : await (apiAsync as any)(apiName)
  ) as ApiResponse<K>;
}

/**
 * useQuery Hook - 用于数据获取（GET 请求）
 *
 * 特性：
 * - ✅ 自动缓存：相同请求自动复用缓存
 * - ✅ 自动重新验证：窗口聚焦、网络恢复时自动刷新
 * - ✅ 依赖刷新：params 变化时自动重新请求
 * - ✅ 条件请求：params 为 null 时不发起请求
 * - ✅ 乐观更新：支持 mutate 进行本地更新
 *
 * @example
 * ```tsx
 * function ContentList() {
 *   const { data, error, isLoading, mutate } = useQuery('GET:/contents', {
 *     page: 1,
 *     pageSize: 20
 *   });
 *
 *   if (isLoading) return <div>加载中...</div>;
 *   if (error) return <div>错误: {error.message}</div>;
 *
 *   return <div>{data?.items.map(...)}</div>;
 * }
 * ```
 */
export function useQuery<K extends ApiName>(
  apiName: K,
  params?: ApiParams<K> | null,
  config?: SWRConfiguration<ApiResponse<K>>,
): SWRResponse<ApiResponse<K>> {
  const key = generateKey(apiName, params as ApiParams<K>);

  return useSWR<ApiResponse<K>>(key, fetcher, {
    revalidateOnFocus: true, // 窗口聚焦时重新验证
    revalidateOnReconnect: true, // 网络恢复时重新验证
    dedupingInterval: 2000, // 2秒内去重
    ...config,
  });
}

/**
 * useMutation Hook - 用于数据提交（POST/PUT/DELETE 请求）
 *
 * @example
 * ```tsx
 * function CreateContent() {
 *   const { trigger, isMutating } = useMutation('POST:/contents');
 *
 *   const handleSubmit = async (formData) => {
 *     try {
 *       const result = await trigger({
 *         title: formData.title,
 *         body: formData.body,
 *       });
 *       console.log('Created:', result);
 *     } catch (error) {
 *       console.error('Failed:', error);
 *     }
 *   };
 *
 *   return <Button onClick={handleSubmit} loading={isMutating}>提交</Button>;
 * }
 * ```
 */
export function useMutation<K extends ApiName>(
  apiName: K,
  config?: SWRMutationConfiguration<ApiResponse<K>, Error, string, ApiParams<K>>,
) {
  const key = apiName; // mutation 使用 apiName 作为 key

  return useSWRMutation<ApiResponse<K>, Error, string, ApiParams<K>>(
    key,
    async (_key, { arg }) => {
      return (
        arg !== undefined ? await (apiAsync as any)(apiName, arg) : await (apiAsync as any)(apiName)
      ) as ApiResponse<K>;
    },
    config,
  );
}

/**
 * 手动刷新指定 key 的缓存
 */
export { mutate } from 'swr';

/**
 * 全局 SWR 配置
 */
export type { SWRConfiguration };
