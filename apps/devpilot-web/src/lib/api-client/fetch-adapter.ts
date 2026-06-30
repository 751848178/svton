/**
 * Fetch 适配器
 *
 * 实现 @svton/api-client 的 HttpAdapter 接口，对接后端 @svton/nestjs-http 信封
 * `{ code, message, data }`，剥离信封后仅返回业务 data。
 *
 * 单一职责：发送请求 + 解析信封 + 归一化错误。
 * 认证 token、X-Team-Id、会话失效处理交由拦截器（见 interceptors.ts）。
 */

import { ApiError, type HttpAdapter, type HttpRequestConfig } from '@svton/api-client';

const SUCCESS_CODE = 0;

/** 后端统一信封格式（@svton/nestjs-http ResponseInterceptor）。 */
interface Envelope<T = unknown> {
  code: number;
  message: string;
  data: T;
  traceId?: string;
  timestamp?: string;
}

function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'data' in value
  );
}

/**
 * 创建 fetch 适配器。
 * 显式控制 credentials（旧 api.ts 使用 include），并统一解析信封与错误。
 */
export function createFetchAdapter(): HttpAdapter {
  return {
    async request<T>(config: HttpRequestConfig): Promise<T> {
      const fullUrl = appendQuery(config.url, config.params);

      let response: Response;
      try {
        response = await fetch(fullUrl, {
          method: config.method,
          headers: { 'Content-Type': 'application/json', ...config.headers },
          body: config.data ? JSON.stringify(config.data) : undefined,
          credentials: 'include',
        });
      } catch (err) {
        throw new ApiError('NETWORK_ERROR', (err as Error)?.message || 'Network request failed');
      }

      const body = await parseBody(response);

      if (response.ok && isEnvelope(body)) {
        if (body.code !== SUCCESS_CODE) {
          throw new ApiError(body.code, body.message, {
            data: body.data,
            traceId: body.traceId,
            url: config.url,
          });
        }
        return body.data as T;
      }

      // 兼容未包装的直返响应（如部分直返数据的端点）
      if (response.ok) {
        return body as T;
      }

      const message =
        (isEnvelope(body) && body.message) ||
        (body && typeof body === 'object' && 'message' in body
          ? String((body as { message: unknown }).message)
          : '') ||
        `HTTP error! status: ${response.status}`;
      throw new ApiError(response.status, message, { ...body, url: config.url });
    },
  };
}

function appendQuery(url: string, params?: Record<string, unknown>): string {
  if (!params) return url;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) search.append(key, String(value));
  });
  const qs = search.toString();
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url;
}

async function parseBody(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
}
