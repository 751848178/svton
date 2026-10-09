import './api-registry';
import { ApiError, createApiClient, type HttpAdapter, type HttpRequestConfig } from '@svton/api-client';
import { authEpoch, notifyUnauthorized, trackProtectedRequest } from '@/auth/session-events';

const adapter: HttpAdapter = {
  async request<T>(config: HttpRequestConfig): Promise<T> {
    const protectedRequest = !/\/auth\/(login|session|logout)$/.test(config.url);
    const epoch = authEpoch();
    const controller = new AbortController();
    const abort = () => controller.abort();
    config.signal?.addEventListener('abort', abort, { once: true });
    if (config.signal?.aborted) abort();
    const release = protectedRequest ? trackProtectedRequest(controller) : () => {};
    try {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(config.params ?? {})) {
        if (value !== undefined && value !== null) query.set(key, String(value));
      }
      const response = await fetch(`${config.url}${query.size ? `?${query}` : ''}`, {
        method: config.method,
        headers: { 'Content-Type': 'application/json', 'x-shipkit-local': '1', ...config.headers },
        body: config.data === undefined ? undefined : JSON.stringify(config.data),
        signal: controller.signal,
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (response.status === 401 && protectedRequest) notifyUnauthorized(epoch);
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body?.message ?? body?.error?.message ?? body?.error ?? `请求失败 (${response.status})`;
        throw new ApiError(response.status, Array.isArray(message) ? message.join('；') : String(message), body);
      }
      return body as T;
    } finally { release(); config.signal?.removeEventListener('abort', abort); }
  },
};

export const { apiAsync: request } = createApiClient(adapter, { baseURL: '/api' });
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '操作失败');
}
