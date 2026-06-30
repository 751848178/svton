/**
 * 认证令牌持久化
 *
 * 单一职责：在 localStorage 与 cookie 之间同步认证状态。
 *
 * - localStorage：供客户端（auth service、api-client token 拦截器）读取。
 * - cookie（token）：供 Next.js middleware 做 SSR 路由保护（见 middleware.ts）。
 * - cookie（teamId）：供 API 请求携带 X-Team-Id（见 team-header 拦截器）。
 *
 * 持久化键名 `auth-storage` 与历史 zustand persist 保持一致，避免清除已登录会话。
 */

import type { AuthUser } from '@/types/api-registry';

const AUTH_STORAGE_KEY = 'auth-storage';
const TOKEN_COOKIE = 'token';
const TEAM_COOKIE = 'teamId';
const TOKEN_MAX_AGE_DAYS = 7;
const TEAM_MAX_AGE_DAYS = 365;

interface PersistedAuth {
  token: string | null;
  user: AuthUser | null;
}

function isBrowser(): boolean {
  return typeof document !== 'undefined';
}

function setCookie(name: string, value: string, maxAgeDays: number): void {
  if (!isBrowser()) return;
  const expires = new Date(Date.now() + maxAgeDays * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

function deleteCookie(name: string): void {
  if (!isBrowser()) return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

export function readCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

/** 读取持久化的认证状态（仅客户端）。 */
export function readPersistedAuth(): PersistedAuth {
  if (typeof window === 'undefined') return { token: null, user: null };
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return { token: null, user: null };
  try {
    const { state } = JSON.parse(raw) as { state?: Partial<PersistedAuth> };
    return { token: state?.token ?? null, user: state?.user ?? null };
  } catch {
    return { token: null, user: null };
  }
}

/** 持久化认证状态并同步 token cookie。 */
export function writePersistedAuth(auth: PersistedAuth): void {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify({ state: auth, version: 0 });
  window.localStorage.setItem(AUTH_STORAGE_KEY, payload);
  if (auth.token) {
    setCookie(TOKEN_COOKIE, auth.token, TOKEN_MAX_AGE_DAYS);
  } else {
    deleteCookie(TOKEN_COOKIE);
  }
}

/** 同步 teamId cookie（供 API X-Team-Id 头读取）。 */
export function syncTeamCookie(teamId: string | null): void {
  if (!isBrowser()) return;
  if (teamId) {
    setCookie(TEAM_COOKIE, teamId, TEAM_MAX_AGE_DAYS);
  } else {
    deleteCookie(TEAM_COOKIE);
  }
}

/** 读取当前 teamId（优先 cookie，回退读取由 team service 维护）。 */
export function readTeamId(): string | null {
  return readCookie(TEAM_COOKIE);
}

/** 清除全部认证与团队持久化状态。 */
export function clearPersistedAuth(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  deleteCookie(TOKEN_COOKIE);
  deleteCookie(TEAM_COOKIE);
}

/** 客户端启动时，把已持久化的 token 同步到 cookie（middleware 可见）。 */
export function bootstrapCookieFromStorage(): void {
  const { token } = readPersistedAuth();
  if (token) setCookie(TOKEN_COOKIE, token, TOKEN_MAX_AGE_DAYS);
}
