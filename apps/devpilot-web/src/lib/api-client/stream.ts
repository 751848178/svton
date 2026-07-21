/**
 * 流式与二进制端点
 *
 * 这类端点（SSE 实时推送、文件下载）不经过 @svton/nestjs-http 信封，
 * 由后端 excludePaths 排除。因此不能用 apiAsync（会剥离信封），
 * 直接用 fetch 并复用认证拦截逻辑。
 *
 * 单一职责：构造带认证/团队头的非信封请求。
 */

import { readPersistedAuth, readTeamId } from '@/lib/auth/token-storage';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3121';

export interface StreamOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string>;
  signal?: AbortSignal;
  /** 额外请求头（如 SSE 的 Last-Event-ID）。 */
  headers?: Record<string, string>;
}

export function buildStreamUrl(endpoint: string, params?: Record<string, string>): string {
  let url = `${API_BASE_URL}/api${endpoint}`;
  if (params) {
    url += `?${new URLSearchParams(params).toString()}`;
  }
  return url;
}

export function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const { token } = readPersistedAuth();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const teamId = readTeamId();
  if (teamId) headers['X-Team-Id'] = teamId;
  return headers;
}

/** SSE 实时流（text/event-stream）。返回原始 Response 供调用方读取 reader。 */
export async function stream(endpoint: string, options: StreamOptions = {}): Promise<Response> {
  const { method = 'GET', body, params, signal, headers } = options;
  const response = await fetch(buildStreamUrl(endpoint, params), {
    method,
    headers: buildHeaders({ Accept: 'text/event-stream', ...headers }),
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
    signal,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `HTTP error! status: ${response.status}`);
  }
  return response;
}

/** 二进制下载（application/octet-stream / StreamableFile）。 */
export async function download(endpoint: string, options: StreamOptions = {}): Promise<Response> {
  const { method = 'GET', params, headers } = options;
  const response = await fetch(buildStreamUrl(endpoint, params), {
    method,
    headers: buildHeaders({ Accept: 'application/octet-stream', ...headers }),
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `HTTP error! status: ${response.status}`);
  }
  return response;
}
