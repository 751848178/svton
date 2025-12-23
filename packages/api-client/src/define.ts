/**
 * API 定义辅助函数
 * 提供类型安全的 API 定义方式
 */

import type { HttpMethod } from './types';

/**
 * API 定义配置
 */
export interface ApiDefinition<TRequest = any, TResponse = any> {
  path: string;
  method: HttpMethod;
  auth?: boolean;
  requestType?: TRequest;
  responseType?: TResponse;
}

/**
 * 无参数标记类型
 */
export type NoParams = void;

/**
 * 定义 API 的辅助函数
 *
 * @example
 * ```ts
 * export const authLogin = defineApi({
 *   path: '/auth/login',
 *   method: 'POST',
 *   auth: false,
 *   requestType: {} as LoginDto,
 *   responseType: {} as LoginVo,
 * })
 * ```
 */
export function defineApi<TRequest = void, TResponse = any>(
  definition: ApiDefinition<TRequest, TResponse>,
): ApiDefinition<TRequest, TResponse> {
  return definition;
}

/**
 * 路径参数替换
 * 'content:/:id' + { id: 1 } => '/content/1'
 */
export function resolvePath(path: string, params?: Record<string, any>): string {
  if (!params) return path;

  let resolved = path;
  for (const [key, value] of Object.entries(params)) {
    resolved = resolved.replace(`:${key}`, String(value));
  }
  return resolved;
}
