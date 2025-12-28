/**
 * API Interceptors
 * 拦截器系统，替代 getToken 和 onUnauthorized
 */

import type { ApiError, HttpMethod } from './types';

/**
 * 请求配置
 */
export interface RequestConfig {
  method: HttpMethod;
  url: string;
  data?: any;
  params?: any;
  headers: Record<string, string>;
}

/**
 * 响应对象
 */
export interface Response<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

/**
 * 请求拦截器
 */
export interface RequestInterceptor {
  (config: RequestConfig): RequestConfig | Promise<RequestConfig>;
}

/**
 * 响应拦截器
 */
export interface ResponseInterceptor {
  <T = any>(response: Response<T>): Response<T> | Promise<Response<T>>;
}

/**
 * 错误拦截器
 */
export interface ErrorInterceptor {
  (error: ApiError): void | Promise<void>;
}

/**
 * 拦截器配置
 */
export interface Interceptors {
  request?: RequestInterceptor[];
  response?: ResponseInterceptor[];
  error?: ErrorInterceptor[];
}

/**
 * 执行请求拦截器
 */
export async function runRequestInterceptors(
  config: RequestConfig,
  interceptors?: RequestInterceptor[],
): Promise<RequestConfig> {
  if (!interceptors || interceptors.length === 0) {
    return config;
  }

  let result = config;
  for (const interceptor of interceptors) {
    result = await interceptor(result);
  }
  return result;
}

/**
 * 执行响应拦截器
 */
export async function runResponseInterceptors<T = any>(
  response: Response<T>,
  interceptors?: ResponseInterceptor[],
): Promise<Response<T>> {
  if (!interceptors || interceptors.length === 0) {
    return response;
  }

  let result = response;
  for (const interceptor of interceptors) {
    result = await interceptor(result);
  }
  return result;
}

/**
 * 执行错误拦截器
 */
export async function runErrorInterceptors(
  error: ApiError,
  interceptors?: ErrorInterceptor[],
): Promise<void> {
  if (!interceptors || interceptors.length === 0) {
    return;
  }

  for (const interceptor of interceptors) {
    await interceptor(error);
  }
}

// ========== 常用拦截器 ==========

/**
 * Token 请求拦截器
 */
export function createTokenInterceptor(
  getToken: () => string | null | Promise<string | null>,
): RequestInterceptor {
  return async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  };
}

/**
 * 401 错误拦截器
 */
export function createUnauthorizedInterceptor(onUnauthorized: () => void): ErrorInterceptor {
  return (error) => {
    if (error.code === 401 || error.code === '401') {
      onUnauthorized();
    }
  };
}

/**
 * 日志拦截器
 */
export function createLogInterceptor(): {
  request: RequestInterceptor;
  response: ResponseInterceptor;
  error: ErrorInterceptor;
} {
  return {
    request: (config) => {
      console.log('[API Request]', config.method, config.url, config);
      return config;
    },
    response: (response) => {
      console.log('[API Response]', response.status, response.data);
      return response;
    },
    error: (error) => {
      console.error('[API Error]', error.code, error.message, error.details);
    },
  };
}
