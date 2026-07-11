/**
 * API 拦截器
 *
 * 单一职责：构造请求/错误拦截器，注入认证与团队上下文，统一处理会话失效。
 *
 * - 请求拦截：注入 Authorization（从 token-storage 读取）、X-Team-Id（从 cookie 读取）。
 * - 错误拦截：401 → 清除认证持久化 + 跳转登录页（对齐旧 auth-store 行为）。
 */

import {
  createTokenInterceptor,
  type ErrorInterceptor,
  type Interceptors,
  type RequestInterceptor,
} from '@svton/api-client';
import { readPersistedAuth, readTeamId, clearPersistedAuth } from '@/lib/auth/token-storage';
import { buildLoginRedirectPath } from '@/lib/auth/redirect-path.utils';

/** 路径以这些结尾时，401 属于业务错误（登录/注册），不触发会话清理。 */
const AUTH_FLOW_SUFFIXES = ['/auth/login', '/auth/register', '/auth/refresh'];

function normalizePath(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return url;
  }
}

function isAuthFlow(url?: string): boolean {
  const pathname = normalizePath(url);
  return AUTH_FLOW_SUFFIXES.some((suffix) => pathname.endsWith(suffix));
}

/** 注入 X-Team-Id 请求头（团队级资源隔离）。 */
export const teamHeaderInterceptor: RequestInterceptor = (config) => {
  const teamId = readTeamId();
  if (teamId && !config.headers['X-Team-Id']) {
    config.headers['X-Team-Id'] = teamId;
  }
  return config;
};

/** 注入 Bearer token（从持久化存储读取，确保服务端渲染后客户端可用）。 */
export const tokenRequestInterceptor = createTokenInterceptor(() => {
  return readPersistedAuth().token;
});

/** 401 会话失效：清除认证并跳转登录页（除非是登录流程本身的 401）。 */
export const sessionExpiredInterceptor: ErrorInterceptor = (error) => {
  const isUnauthorized = error.code === 401 || error.code === '401';
  if (!isUnauthorized) return;

  if (typeof window === 'undefined') return;

  // 登录/注册接口的 401 属于业务错误（凭证错误），不清理会话
  const requestUrl = (error.details as { url?: string } | undefined)?.url;
  if (isAuthFlow(requestUrl)) return;

  clearPersistedAuth();
  window.location.href = buildLoginRedirectPath(window.location.pathname, window.location.search);
};

/** 组装全量拦截器，供 createApiClient 使用。 */
export function createInterceptors(): Interceptors {
  return {
    request: [tokenRequestInterceptor, teamHeaderInterceptor],
    error: [sessionExpiredInterceptor],
  };
}
