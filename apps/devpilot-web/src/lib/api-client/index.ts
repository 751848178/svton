/**
 * Devpilot API Client 入口
 *
 * 基于 @svton/api-client，对齐 picshare 范式：
 * - api / apiAsync：类型化的字符串路由调用（路由类型见 @/types/api-registry）。
 * - runGenerator：多请求编排（失败静默中止）。
 * - apiRequest：宽松入口，供尚未登记类型的端点使用（迁移过渡）。
 *
 * 必须引入 @/types/api-registry 以激活模块增强。
 */

// 引入模块增强（顺序敏感，必须在 createApiClient 之前）
import '@/types/api-registry';

import { createApiClient } from '@svton/api-client';
import type { ApiName, ApiParams, ApiResponse } from '@svton/api-client';
import { createFetchAdapter } from './fetch-adapter';
import { createInterceptors } from './interceptors';
import './registry';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3121';

const { api, apiAsync, runGenerator } = createApiClient(createFetchAdapter(), {
  baseURL: `${API_BASE_URL}/api`,
  interceptors: createInterceptors(),
});

export { api, apiAsync, runGenerator };

/**
 * 宽松请求入口：接受任意 `METHOD:/path` 字符串。
 *
 * 用于尚未登记到 GlobalApiRegistry 的端点（登记过的请用 `apiAsync` 获得完整类型推导）。
 * 调用方用泛型 `apiRequest<T>(...)` 显式声明响应类型（语义与历史 `api.get<T>` 一致）。
 */
export async function apiRequest<T = unknown>(
  apiName: string,
  params?: unknown,
): Promise<T> {
  return (apiAsync as unknown as (name: string, p?: unknown) => Promise<T>)(apiName, params);
}

/** 类型化调用的便捷别名（等价 apiAsync）。 */
export function request<K extends ApiName>(
  apiName: K,
  ...args: ApiParams<K> extends void ? [] : [ApiParams<K>]
): Promise<ApiResponse<K>> {
  return apiAsync(apiName, ...args);
}
