/**
 * catchError 工具函数
 * 
 * 用于在 Generator 函数中捕获 API 错误，而不中止后续代码执行
 */

import type { ApiName, ApiParams, ApiResponse } from './global-types';
import { ApiError } from './types';

/**
 * API 错误响应
 */
export interface ApiErrorResponse {
  error: ApiError;
  data: null;
}

/**
 * API 成功响应
 */
export interface ApiSuccessResponse<T> {
  error: null;
  data: T;
}

/**
 * API 响应（成功或失败）
 */
export type ApiResult<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * catchError 工具函数
 * 
 * 包装 api() 调用，捕获错误而不中止 Generator 执行
 * 
 * @param apiGenerator - api() 返回的 Generator
 * @returns Promise<ApiResult<T>> - 包含 error 和 data 的结果对象
 * 
 * @example
 * ```typescript
 * @action()
 * *loadUserData(id: number) {
 *   // 必须成功的请求（失败会中止）
 *   const user = yield* api('GET:/users/:id', { id });
 *   this.user = user;
 *   
 *   // 可以失败的请求（失败不会中止）
 *   const result = yield* catchError(api('GET:/users/:id/avatar', { id }));
 *   if (result.error) {
 *     this.avatar = '/default-avatar.png';
 *   } else {
 *     this.avatar = result.data;
 *   }
 *   
 *   // 后续代码继续执行
 *   console.log('Done');
 * }
 * ```
 */
export function* catchError<T>(
  apiGenerator: Generator<Promise<T>, T, T>
): Generator<Promise<ApiResult<T>>, ApiResult<T>, ApiResult<T>> {
  // 包装 Promise，捕获错误
  const promise = (async () => {
    try {
      // 执行 generator 的第一步
      const { value } = apiGenerator.next();
      const result = await value;
      
      // 将结果传回 generator
      const finalResult = apiGenerator.next(result);
      
      return {
        error: null,
        data: finalResult.value,
      } as ApiSuccessResponse<T>;
    } catch (error) {
      const apiError = error instanceof ApiError
        ? error
        : new ApiError(
            'UNKNOWN_ERROR',
            error instanceof Error ? error.message : 'Unknown error',
          );
      
      return {
        error: apiError,
        data: null,
      } as ApiErrorResponse;
    }
  })();
  
  const result = yield promise as any;
  return result;
}
