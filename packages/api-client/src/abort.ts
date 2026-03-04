/**
 * API 中止机制
 * 
 * 提供类似 AbortController 的机制，但用于 Generator 函数的静默停止
 */

/**
 * API 中止信号
 * 当 API 请求失败时，通过这个特殊的 Symbol 来标记需要中止执行
 */
export const API_ABORT_SIGNAL = Symbol('API_ABORT_SIGNAL');

/**
 * API 中止错误
 * 这是一个特殊的错误类型，用于标记 Generator 应该静默停止
 */
export class ApiAbortError extends Error {
  readonly [API_ABORT_SIGNAL] = true;
  readonly originalError: Error;

  constructor(error: Error) {
    super('API request aborted');
    this.name = 'ApiAbortError';
    this.originalError = error;
  }
}

/**
 * 检查是否是中止信号
 */
export function isAbortSignal(error: any): error is ApiAbortError {
  return error && error[API_ABORT_SIGNAL] === true;
}

/**
 * 创建中止信号
 */
export function createAbortSignal(error: Error): ApiAbortError {
  return new ApiAbortError(error);
}
