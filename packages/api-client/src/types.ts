/**
 * API Client 工具类型
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * API 端点定义
 */
export interface ApiEndpoint<TParams = void, TResponse = any> {
  method: HttpMethod;
  path: string | ((params: TParams) => string);
  auth?: boolean; // 是否需要认证
}

/**
 * API Registry 类型
 */
export type ApiRegistry = Record<string, ApiEndpoint<any, any>>;

/**
 * 从 Registry 中提取 API 名称
 */
export type ApiName<T extends ApiRegistry> = keyof T;

/**
 * 从 Registry 中提取参数类型
 */
export type ApiParams<T extends ApiRegistry, K extends ApiName<T>> =
  T[K] extends ApiEndpoint<infer P, any> ? P : never;

/**
 * 从 Registry 中提取响应类型
 */
export type ApiResponse<T extends ApiRegistry, K extends ApiName<T>> =
  T[K] extends ApiEndpoint<any, infer R> ? R : never;

/**
 * API 配置
 */
export interface ApiConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  getToken?: () => string | null | undefined;
  onUnauthorized?: () => void;
}

/**
 * API 错误
 */
export class ApiError extends Error {
  constructor(
    public code: string | number,
    message: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
