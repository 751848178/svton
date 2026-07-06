/**
 * 云厂商 API 调用的重试/超时公共工具。
 *
 * 取代 `aliyun-sls-log-query.adapter.ts` 与 `cloud-provider-inventory.service.ts`
 * 里近乎逐字复制的 `executeProviderCall`/`withTimeout`/`sleep`/`isRetryableProviderError`。
 *
 * 保留原有语义：线性退避（`baseDelayMs * (attempt+1)`）、可变 `attempts`/`retries` 计数器、
 * 超时与可重试错误关键字判断，确保替换后行为与已 pin 的测试一致。
 */

export type ProviderRequestPolicy = {
  timeoutMs: number;
  retryAttempts: number;
  retryBaseDelayMs: number;
  attempts: number;
  retries: number;
};

const RETRYABLE_ERROR_PATTERNS = [
  'timeout',
  'timed out',
  'throttl',
  'rate',
  'too many',
  'temporarily unavailable',
  'serviceunavailable',
  'internalerror',
  'econnreset',
  'etimedout',
];

/** 从任意错误对象中提取可读消息（兼容 Error / {message|Message} / 原始值）。 */
export function providerErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  if (error && typeof error === 'object' && 'Message' in error) {
    const m = (error as { Message: unknown }).Message;
    if (typeof m === 'string' && m) return m;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** 判断错误是否可重试（基于消息关键字）。 */
export function isRetryableProviderError(error: unknown): boolean {
  const message = providerErrorMessage(error).toLowerCase();
  return RETRYABLE_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

/** Promise 超时保护。超时抛 `${label} timed out after ${timeoutMs}ms`。 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 执行一次带超时与线性退避重试的 provider 调用。
 *
 * 副作用：会递增 `policy.attempts`（每次尝试）与 `policy.retries`（每次实际重试），
 * 与原实现一致，调用方依赖这两个计数器读统计。
 */
export async function executeProviderCall<T>(
  policy: ProviderRequestPolicy,
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= policy.retryAttempts; attempt += 1) {
    policy.attempts += 1;
    try {
      return await withTimeout(fn(), policy.timeoutMs, label);
    } catch (error) {
      lastError = error;
      const canRetry = attempt < policy.retryAttempts && isRetryableProviderError(error);
      if (!canRetry) break;
      policy.retries += 1;
      await sleep(policy.retryBaseDelayMs * (attempt + 1));
    }
  }

  throw lastError;
}
