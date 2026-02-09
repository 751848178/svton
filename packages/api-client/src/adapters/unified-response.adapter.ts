/**
 * 统一响应结构适配器
 * 
 * 适配常见的统一响应格式：
 * { code, message, data, traceId?, timestamp? }
 * 
 * 兼容：
 * - @svton/nestjs-http
 * - Spring Boot 统一响应
 * - 其他类似格式的后端框架
 */

import { ApiError, type HttpMethod } from '../types';
import type { HttpAdapter, HttpRequestConfig } from '../client';

/**
 * 统一响应格式
 */
export interface UnifiedResponse<T = any> {
  code: number | string;
  message: string;
  data: T;
  traceId?: string;
  timestamp?: string;
  [key: string]: any; // 允许额外字段
}

/**
 * 适配器配置
 */
export interface UnifiedResponseAdapterConfig {
  /**
   * 成功响应的 code 值（默认 0）
   * 可以是数字或字符串，如 0, 200, "SUCCESS" 等
   */
  successCode?: number | string;
  
  /**
   * 是否在错误时抛出 ApiError（默认 true）
   */
  throwOnError?: boolean;
  
  /**
   * 自定义错误处理
   */
  onError?: (response: UnifiedResponse) => void;
  
  /**
   * 自定义响应格式验证
   * 默认检查 code, message, data 字段
   */
  validateResponse?: (data: any) => boolean;
}

/**
 * 创建统一响应适配器
 * 
 * 适用于以下响应格式：
 * - @svton/nestjs-http: { code: 0, message: "success", data: {...} }
 * - Spring Boot: { code: 200, message: "OK", data: {...} }
 * - 自定义格式: { code: "SUCCESS", message: "操作成功", data: {...} }
 * 
 * @example
 * ```typescript
 * import { createApiClient } from '@svton/api-client';
 * import { createUnifiedResponseAdapter } from '@svton/api-client/adapters';
 * 
 * // @svton/nestjs-http 格式
 * const adapter = createUnifiedResponseAdapter(fetch, {
 *   successCode: 0
 * });
 * 
 * // Spring Boot 格式
 * const adapter = createUnifiedResponseAdapter(fetch, {
 *   successCode: 200
 * });
 * 
 * // 自定义格式
 * const adapter = createUnifiedResponseAdapter(fetch, {
 *   successCode: "SUCCESS",
 *   onError: (response) => {
 *     console.error('API Error:', response.message);
 *   }
 * });
 * 
 * const { apiAsync } = createApiClient(adapter, {
 *   baseURL: 'https://api.example.com'
 * });
 * ```
 */
export function createUnifiedResponseAdapter(
  fetcher: typeof fetch,
  config?: UnifiedResponseAdapterConfig
): HttpAdapter {
  const successCode = config?.successCode ?? 0;
  const throwOnError = config?.throwOnError ?? true;
  const validateResponse = config?.validateResponse ?? isUnifiedResponse;

  return {
    async request<T = any>(requestConfig: HttpRequestConfig): Promise<T> {
      // 构建完整 URL（包含 query 参数）
      let fullUrl = requestConfig.url;
      if (requestConfig.params) {
        const searchParams = new URLSearchParams();
        Object.entries(requestConfig.params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
          }
        });
        const queryString = searchParams.toString();
        if (queryString) {
          fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
        }
      }

      // 发送请求
      const response = await fetcher(fullUrl, {
        method: requestConfig.method,
        headers: requestConfig.headers,
        body: requestConfig.data ? JSON.stringify(requestConfig.data) : undefined,
      });

      // 解析响应
      const unifiedResponse = await response.json() as UnifiedResponse<T>;

      // 检查响应格式
      if (!validateResponse(unifiedResponse)) {
        throw new ApiError(
          'INVALID_RESPONSE_FORMAT',
          'Response does not match unified response format',
          unifiedResponse
        );
      }

      // 检查业务状态码
      if (unifiedResponse.code !== successCode) {
        // 触发错误回调
        config?.onError?.(unifiedResponse);

        // 抛出错误
        if (throwOnError) {
          throw new ApiError(
            unifiedResponse.code,
            unifiedResponse.message,
            {
              data: unifiedResponse.data,
              traceId: unifiedResponse.traceId,
              timestamp: unifiedResponse.timestamp,
            }
          );
        }
      }

      // 返回业务数据
      return unifiedResponse.data;
    },
  };
}

/**
 * 类型守卫：检查是否为统一响应格式
 */
function isUnifiedResponse(data: any): data is UnifiedResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'code' in data &&
    'message' in data &&
    'data' in data
  );
}

