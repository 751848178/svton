'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
}

// 设置 cookie（用于 middleware 读取）
function setCookie(name: string, value: string, days = 7) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

// 删除 cookie
function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

// 获取 cookie
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,

      setAuth: (token: string, user: User) => {
        // 同步设置 cookie 供 middleware 使用
        setCookie('token', token);
        // 设置 API client 的 token getter
        api.setTokenGetter(() => token);
        // 设置 teamId getter（从 cookie 读取）
        api.setTeamIdGetter(() => getCookie('teamId'));
        set({ token, user, isAuthenticated: true });
      },

      logout: () => {
        deleteCookie('token');
        deleteCookie('teamId');
        api.setTokenGetter(() => null);
        api.setTeamIdGetter(() => null);
        set({ token: null, user: null, isAuthenticated: false });
        // 重定向到登录页
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ isAuthenticated: false });
          return false;
        }

        try {
          api.setTokenGetter(() => token);
          api.setTeamIdGetter(() => getCookie('teamId'));
          const user = await api.get<User>('/auth/profile');
          set({ user, isAuthenticated: true });
          return true;
        } catch {
          // Token 无效，清除认证状态
          deleteCookie('token');
          set({ token: null, user: null, isAuthenticated: false });
          return false;
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await api.post<{ accessToken: string; user: User }>(
            '/auth/login',
            { email, password }
          );
          get().setAuth(response.accessToken, response.user);
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (email: string, password: string, name?: string) => {
        set({ isLoading: true });
        try {
          const response = await api.post<{ accessToken: string; user: User }>(
            '/auth/register',
            { email, password, name }
          );
          get().setAuth(response.accessToken, response.user);
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        // 恢复时同步 cookie 和 API token
        if (state?.token) {
          setCookie('token', state.token);
          api.setTokenGetter(() => state.token);
          api.setTeamIdGetter(() => getCookie('teamId'));
          state.isAuthenticated = true;
        }
      },
    }
  )
);

// 初始化：在客户端启动时检查并同步 cookie
if (typeof window !== 'undefined') {
  // 从 localStorage 读取并同步到 cookie
  const stored = localStorage.getItem('auth-storage');
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      if (state?.token) {
        setCookie('token', state.token);
      }
    } catch {
      // ignore parse error
    }
  }
}
