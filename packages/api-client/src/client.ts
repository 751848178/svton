/**
 * API 客户端 - 模块增强架构
 * 保持模块增强类型系统，采用 client-v2.ts 的核心实现
 */

import { ApiError, type HttpMethod } from './types';
import type { ApiName, ApiParams, ApiResponse } from './global-types';
import type { Interceptors } from './interceptors';
import {
  runRequestInterceptors,
  runResponseInterceptors,
  runErrorInterceptors,
} from './interceptors';

/**
 * HTTP 请求接口（适配器模式）
 */
export interface HttpAdapter {
  request<T = any>(config: {
    method: HttpMethod;
    url: string;
    data?: any;
    params?: any;
    headers?: Record<string, string>;
  }): Promise<T>;
}

/**
 * API 客户端配置
 */
export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  interceptors?: Interceptors;
}

/**
 * 路径解析函数
 */
function resolvePath(pattern: string, params: any): string {
  if (!params || typeof params !== 'object') {
    return pattern;
  }
  
  let path = pattern;
  Object.keys(params).forEach(key => {
    if (path.includes(`:${key}`)) {
      path = path.replace(`:${key}`, encodeURIComponent(String(params[key])));
    }
  });
  
  return path;
}

/**
 * 创建 API 客户端
 */
export function createApiClient(
  adapter: HttpAdapter,
  config?: ApiClientConfig
) {
  
  /**
   * 核心请求函数（采用 client-v2.ts 的完善实现）
   */
  async function executeRequest<K extends ApiName>(
    apiName: K,
    params: ApiParams<K>
  ): Promise<ApiResponse<K>> {
    // 修复：只在第一个冒号处分割，保留路径中的参数占位符
    const colonIndex = (apiName as string).indexOf(':');
    if (colonIndex === -1) {
      throw new ApiError('INVALID_API_NAME', `Invalid API name format: ${String(apiName)}`);
    }
    const method = (apiName as string).substring(0, colonIndex) as HttpMethod;
    const path = (apiName as string).substring(colonIndex + 1);
    
    if (!method || !path) {
      throw new ApiError('INVALID_API_NAME', `Invalid API name: ${String(apiName)}`);
    }

    try {
      // 提取路径参数名称
      const pathParamNames = (path.match(/:([^/]+)/g) || []).map((p) => p.slice(1));
      
      // 先处理参数分离，再进行路径替换
      let queryParams: any = undefined;
      let bodyData: any = undefined;
      let pathParams: any = {};
      
      if (params && typeof params === 'object') {
        const paramsObj = params as any;
        
        // 提取路径参数
        pathParamNames.forEach((paramName) => {
          if (paramName in paramsObj) {
            pathParams[paramName] = paramsObj[paramName];
          }
        });
        
        if (method === 'GET') {
          // GET 请求：剩余参数作为 query 参数
          queryParams = { ...paramsObj };
          pathParamNames.forEach((paramName) => {
            delete queryParams[paramName];
          });
          // 如果没有剩余参数，设为 undefined
          if (Object.keys(queryParams).length === 0) {
            queryParams = undefined;
          }
        } else {
          // 其他请求：处理 body 数据
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
      }
      
      // 使用路径参数进行路径替换
      const resolvedPath = resolvePath(path, pathParams);
      const url = `${config?.baseURL}${resolvedPath}`;

      // 准备请求配置
      let requestConfig: import('./interceptors').RequestConfig = {
        method,
        url,
        data: bodyData,
        params: queryParams,
        headers: { 
          'Content-Type': 'application/json',
          ...config?.headers 
        },
      };

      // 执行请求拦截器
      requestConfig = await runRequestInterceptors(requestConfig, config?.interceptors?.request);

      // 发送请求
      const result = await adapter.request(requestConfig);

      // 执行响应拦截器
      await runResponseInterceptors(
        { data: result, status: 200, headers: {} },
        config?.interceptors?.response,
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
      await runErrorInterceptors(apiError, config?.interceptors?.error);

      throw apiError;
    }
  }

  /**
   * Generator API 调用（采用 client-v2.ts 的 Generator 实现）
   *
   * @example
   * ```ts
   * function* loadData() {
   *   const user = yield* api('GET:/auth/me')
   *   const contents = yield* api('GET:/contents', { page: 1 })
   *   return { user, contents }
   * }
   *
   * const data = await runGenerator(loadData())
   * ```
   */
  function* api<K extends ApiName>(
    apiName: K,
    ...args: ApiParams<K> extends void ? [] : [ApiParams<K>]
  ): Generator<Promise<ApiResponse<K>>, ApiResponse<K>, ApiResponse<K>> {
    const params = args[0] as ApiParams<K>;
    const promise = executeRequest(apiName, params);
    const result = yield promise;
    return result;
  }

  /**
   * Promise API 调用（别名）
   *
   * @example
   * ```ts
   * const user = await apiAsync('GET:/auth/me')
   * const contents = await apiAsync('GET:/contents', { page: 1 })
   * ```
   */
  async function apiAsync<K extends ApiName>(
    apiName: K,
    ...args: ApiParams<K> extends void ? [] : [ApiParams<K>]
  ): Promise<ApiResponse<K>> {
    const params = args[0] as ApiParams<K>;
    return executeRequest(apiName, params);
  }

  /**
   * 执行 Generator（采用 client-v2.ts 的稳定实现）
   *
   * @example
   * ```ts
   * function* loadMultiple() {
   *   const user = yield* api('GET:/auth/me')
   *   const list = yield* api('GET:/contents', { page: 1 })
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
    api,
    apiAsync,
    runGenerator,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
