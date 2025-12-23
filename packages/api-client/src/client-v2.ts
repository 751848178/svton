/**
 * API Client V2
 * 优化版本：
 * 1. api() 默认返回 Generator
 * 2. apiAsync() 返回 Promise
 * 3. 支持 Interceptors
 * 4. 路径风格 API 名称
 */

import type { ApiDefinition } from './define';
import { resolvePath } from './define';
import { ApiError } from './types';
import type { Interceptors } from './interceptors';
import {
  runRequestInterceptors,
  runResponseInterceptors,
  runErrorInterceptors,
} from './interceptors';

/**
 * HTTP 适配器接口
 */
export interface HttpAdapter {
  request<T = any>(config: {
    method: string;
    url: string;
    data?: any;
    params?: any;
    headers?: Record<string, string>;
  }): Promise<T>;
}

/**
 * API Registry 类型
 */
export type ApiRegistry = Record<string, ApiDefinition<any, any>>;

/**
 * API 名称类型
 */
export type ApiName<T extends ApiRegistry> = keyof T;

/**
 * 提取请求参数类型
 */
export type ApiParams<T extends ApiRegistry, K extends ApiName<T>> =
  T[K] extends ApiDefinition<infer P, any> ? P : never;

/**
 * 提取响应类型
 */
export type ApiResponse<T extends ApiRegistry, K extends ApiName<T>> =
  T[K] extends ApiDefinition<any, infer R> ? R : never;

/**
 * 客户端配置
 */
export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  interceptors?: Interceptors;
}

/**
 * 创建 API 客户端 V2
 */
export function createApiClient<T extends ApiRegistry>(
  registry: T,
  adapter: HttpAdapter,
  config: ApiClientConfig,
) {
  /**
   * 核心请求函数（内部使用）
   */
  async function executeRequest<K extends ApiName<T>>(
    apiName: K,
    params: ApiParams<T, K>,
  ): Promise<ApiResponse<T, K>> {
    const definition = registry[apiName];

    if (!definition) {
      throw new ApiError('API_NOT_FOUND', `API ${String(apiName)} not found in registry`);
    }

    try {
      // 解析路径并提取路径参数
      const pathParamNames = (definition.path.match(/:(\w+)/g) || []).map((p) => p.slice(1));
      const path = resolvePath(definition.path, params as any);
      const url = `${config.baseURL}${path}`;

      // 对于 GET 请求，需要排除路径参数，只保留 query 参数
      let queryParams: any = undefined;
      let bodyData: any = undefined;
      
      if (definition.method === 'GET' && params) {
        queryParams = { ...(params as any) };
        // 移除路径参数
        pathParamNames.forEach((paramName) => {
          delete queryParams[paramName];
        });
        // 如果没有剩余参数，设为 undefined
        if (Object.keys(queryParams).length === 0) {
          queryParams = undefined;
        }
      } else if (definition.method !== 'GET' && params) {
        // 对于 PUT/POST/PATCH/DELETE 请求，需要排除路径参数，只保留 body 数据
        const paramsObj = params as any;
        
        // 检查是否有嵌套的 data 字段（如 { id: 1, data: {...} }）
        if (paramsObj.data && typeof paramsObj.data === 'object') {
          // 使用嵌套的 data 作为 body
          bodyData = paramsObj.data;
        } else {
          // 否则复制整个 params 并移除路径参数
          bodyData = { ...paramsObj };
          pathParamNames.forEach((paramName) => {
            delete bodyData[paramName];
          });
          // 如果没有剩余字段，设为 undefined
          if (Object.keys(bodyData).length === 0) {
            bodyData = undefined;
          }
        }
      }

      // 准备请求配置
      let requestConfig: import('./interceptors').RequestConfig = {
        method: definition.method,
        url,
        data: bodyData,
        params: queryParams,
        headers: { ...config.headers },
      };

      // 执行请求拦截器
      requestConfig = await runRequestInterceptors(requestConfig, config.interceptors?.request);

      // 发送请求
      const result = await adapter.request(requestConfig);

      // 执行响应拦截器
      await runResponseInterceptors(
        { data: result, status: 200, headers: {} },
        config.interceptors?.response,
      );

      return result;
    } catch (error: any) {
      // 转换为 ApiError
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError(
              error.response?.status || 'NETWORK_ERROR',
              error.response?.data?.message || error.message || 'API request failed',
              error.response?.data,
            );

      // 执行错误拦截器
      await runErrorInterceptors(apiError, config.interceptors?.error);

      throw apiError;
    }
  }

  /**
   * Generator API 调用（默认方式）
   *
   * @example
   * ```ts
   * function* loadData() {
   *   const user = yield* api('auth:/me')
   *   const contents = yield* api('content:/list', { page: 1 })
   *   return { user, contents }
   * }
   *
   * const data = await runGenerator(loadData())
   * ```
   */
  function* api<K extends ApiName<T>>(
    apiName: K,
    ...args: ApiParams<T, K> extends void ? [] : [ApiParams<T, K>]
  ): Generator<Promise<ApiResponse<T, K>>, ApiResponse<T, K>, ApiResponse<T, K>> {
    const params = args[0] as ApiParams<T, K>;
    const promise = executeRequest(apiName, params);
    const result = yield promise;
    return result;
  }

  /**
   * Promise API 调用（别名）
   *
   * @example
   * ```ts
   * const user = await apiAsync('auth:/me')
   * const contents = await apiAsync('content:/list', { page: 1 })
   * ```
   */
  async function apiAsync<K extends ApiName<T>>(
    apiName: K,
    ...args: ApiParams<T, K> extends void ? [] : [ApiParams<T, K>]
  ): Promise<ApiResponse<T, K>> {
    const params = args[0] as ApiParams<T, K>;
    return executeRequest(apiName, params);
  }

  /**
   * 执行 Generator
   *
   * @example
   * ```ts
   * function* loadMultiple() {
   *   const user = yield* api('auth:/me')
   *   const list = yield* api('content:/list', { page: 1 })
   *   return { user, list }
   * }
   *
   * const result = await runGenerator(loadMultiple())
   * ```
   */
  async function runGenerator<R>(generator: Generator<Promise<any>, R, any>): Promise<R> {
    let result = generator.next();

    while (!result.done) {
      try {
        const value = await result.value;
        result = generator.next(value);
      } catch (error) {
        generator.throw?.(error);
        throw error;
      }
    }

    return result.value;
  }

  return {
    api, // 默认 generator
    apiAsync, // Promise 别名
    runGenerator,
  };
}

/**
 * 导出类型
 */
export type ApiClient<T extends ApiRegistry> = ReturnType<typeof createApiClient<T>>;
