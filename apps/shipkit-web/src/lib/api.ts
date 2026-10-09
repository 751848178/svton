import './api-registry';
import { ApiError, createApiClient, type HttpAdapter, type HttpRequestConfig } from '@svton/api-client';

const adapter: HttpAdapter = {
  async request<T>(config: HttpRequestConfig): Promise<T> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(config.params ?? {})) {
      if (value !== undefined && value !== null) query.set(key, String(value));
    }
    const response = await fetch(`${config.url}${query.size ? `?${query}` : ''}`, {
      method: config.method,
      headers: { 'Content-Type': 'application/json', 'x-shipkit-local': '1', ...config.headers },
      body: config.data === undefined ? undefined : JSON.stringify(config.data),
      signal: config.signal,
      cache: 'no-store',
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = body?.message ?? body?.error?.message ?? body?.error ?? `请求失败 (${response.status})`;
      throw new ApiError(response.status, Array.isArray(message) ? message.join('；') : String(message), body);
    }
    return body as T;
  },
};

export const { apiAsync: request } = createApiClient(adapter, { baseURL: '/api' });
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '操作失败');
}
