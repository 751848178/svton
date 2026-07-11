/**
 * 认证 Service
 *
 * 单一职责：管理登录态（token、user）与认证流程（login/register/logout/checkAuth）。
 *
 * - 状态：@observable() token / user / isAuthenticated / isLoading。
 * - 持久化：通过 token-storage 同步 localStorage 与 cookie（middleware 可见）。
 * - api-client 的 token 注入由拦截器直接读取持久化层，不依赖本 service。
 */

import { Service, observable, action } from '@svton/service';
import { apiAsync } from '@/lib/api-client';
import { AUTH_ROUTES } from '@/lib/api-client/registry';
import type { AuthUser, AuthLoginInput, AuthRegisterInput } from '@/types/api-registry';
import {
  writePersistedAuth,
  readPersistedAuth,
  clearPersistedAuth,
  bootstrapCookieFromStorage,
} from '@/lib/auth/token-storage';
import { buildLoginRedirectPath } from '@/lib/auth/redirect-path.utils';

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  window.location.href = buildLoginRedirectPath(window.location.pathname, window.location.search);
}

@Service()
export class AuthService {
  @observable() token: string | null = null;
  @observable() user: AuthUser | null = null;
  @observable() isAuthenticated = false;
  @observable() isLoading = false;

  /** 从持久化层恢复登录态（客户端启动 / provider 挂载时调用）。 */
  @action() hydrate(): void {
    const { token, user } = readPersistedAuth();
    if (token) {
      this.token = token;
      this.user = user;
      this.isAuthenticated = true;
    }
  }

  /** 写入登录态并持久化。 */
  private commit(token: string, user: AuthUser): void {
    this.token = token;
    this.user = user;
    this.isAuthenticated = true;
    writePersistedAuth({ token, user });
  }

  @action() async login(input: AuthLoginInput): Promise<void> {
    this.isLoading = true;
    try {
      const res = await apiAsync(AUTH_ROUTES.LOGIN, input);
      this.commit(res.accessToken, res.user);
    } finally {
      this.isLoading = false;
    }
  }

  @action() async register(input: AuthRegisterInput): Promise<void> {
    this.isLoading = true;
    try {
      const res = await apiAsync(AUTH_ROUTES.REGISTER, input);
      this.commit(res.accessToken, res.user);
    } finally {
      this.isLoading = false;
    }
  }

  @action() async checkAuth(): Promise<boolean> {
    if (!this.token) {
      this.isAuthenticated = false;
      return false;
    }
    try {
      const user = await apiAsync(AUTH_ROUTES.PROFILE);
      this.user = user;
      this.isAuthenticated = true;
      return true;
    } catch {
      this.reset();
      redirectToLogin();
      return false;
    }
  }

  @action() logout(): void {
    this.reset();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  private reset(): void {
    this.token = null;
    this.user = null;
    this.isAuthenticated = false;
    clearPersistedAuth();
  }
}

/** 客户端启动时同步 cookie（middleware 路由保护依赖 token cookie）。 */
if (typeof window !== 'undefined') {
  bootstrapCookieFromStorage();
}
