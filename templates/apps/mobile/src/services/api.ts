/**
 * Mobile 端 API Client
 * 使用 @svton/api-client 系统
 */

import Taro from '@tarojs/taro';
import { createApiClient, createTokenInterceptor } from '@svton/api-client';
// 引入类型定义以启用模块增强
import '{{ORG_NAME}}/types';

// API 基础 URL（从 Taro 配置文件的 defineConstants 中注入）
// 注意：API_BASE_URL 是一个全局常量，在编译时由 Taro 配置文件注入
declare const API_BASE_URL: string;

/**
 * Taro 适配器
 */
const taroAdapter = {
  async request(config: any) {
    const response = await Taro.request({
      url: config.url,
      method: config.method as any,
      data: config.method === 'GET' ? config.params : config.data,
      header: config.headers,
    });

    const result = response.data;

    // 后端统一包装格式：{ code: 200, message: 'success', data: T, ... }
    if (result && typeof result === 'object' && 'code' in result) {
      if ((result as any).code !== 200) {
        const error: any = new Error((result as any).message || 'Request failed');
        error.code = (result as any).code;
        error.response = {
          status: (result as any).code,
          data: result,
        };
        throw error;
      }
      return (result as any).data;
    }

    // 兼容未包装响应
    return result;
  },
};

/**
 * 刷新 Token
 */
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = Taro.getStorageSync('refreshToken');
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await Taro.request({
      url: `${API_BASE_URL}/auth/refresh`,
      method: 'POST',
      data: { refreshToken },
      header: {
        'Content-Type': 'application/json',
      },
    });

    const result = response.data as any;

    if (result && result.code === 200 && result.data && result.data.accessToken) {
      const newToken = result.data.accessToken as string;
      const newRefreshToken = result.data.refreshToken as string | undefined;

      Taro.setStorageSync('token', newToken);
      if (newRefreshToken) {
        Taro.setStorageSync('refreshToken', newRefreshToken);
      }

      return newToken;
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Token 刷新拦截器（错误处理）
 */
const createTokenRefreshInterceptor = () => {
  return async (error: any): Promise<void> => {
    if (error.code === 401 || error.code === '401') {
      const token = Taro.getStorageSync('token');
      const refreshToken = Taro.getStorageSync('refreshToken');

      if (!token || !refreshToken) {
        throw error;
      }

      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await refreshAccessToken();
        isRefreshing = false;

        if (newToken) {
          onRefreshed(newToken);
          return;
        }

        throw error;
      }

      return new Promise((resolve) => {
        subscribeTokenRefresh(() => {
          resolve();
        });
      });
    }

    throw error;
  };
};

/**
 * 创建 API 客户端实例
 */
const { api, apiAsync, runGenerator } = createApiClient(taroAdapter, {
  baseURL: API_BASE_URL,
  interceptors: {
    request: [
      createTokenInterceptor(() => {
        try {
          return Taro.getStorageSync('token');
        } catch {
          return null;
        }
      }),
    ],
    error: [createTokenRefreshInterceptor()],
  },
});

export { api, apiAsync, runGenerator };
