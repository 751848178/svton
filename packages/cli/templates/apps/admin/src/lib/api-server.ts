/**
 * 服务端 API 客户端
 * 基于 @svton/api-client
 * 用于 Next.js 服务端组件中发起认证请求
 */

import { cookies } from 'next/headers';
import { createApiClient, createTokenInterceptor } from '@svton/api-client';
// 引入类型定义以启用模块增强
import '{{ORG_NAME}}/types';

/**
 * Fetch 适配器（用于服务端）
 * 后端使用统一响应格式：{ code, data, message }
 */
const fetchAdapter = {
  async request(config: any) {
    const { method, url, data, params, headers } = config;

    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const fullUrl = `${url}${queryString}`;

    const response = await fetch(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      cache: 'no-store',
    });

    const result = await response.json().catch(() => null);

    // 兼容非 JSON 响应
    if (result === null) {
      if (!response.ok) {
        const error: any = new Error(`HTTP ${response.status}`);
        error.code = response.status;
        error.response = { status: response.status, data: null };
        throw error;
      }
      return result;
    }

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

    if (!response.ok) {
      const error: any = new Error((result as any)?.message || `HTTP ${response.status}`);
      error.code = response.status;
      error.response = { status: response.status, data: result };
      throw error;
    }

    return result;
  },
};

/**
 * 创建服务端 API 客户端实例
 */
const {
  api: serverApi,
  apiAsync: serverApiAsync,
  runGenerator: runServerGenerator,
} = createApiClient(fetchAdapter, {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  interceptors: {
    // 请求拦截器 - 从 Cookie 读取 Token
    request: [
      createTokenInterceptor(async () => {
        try {
          const cookieStore = await cookies();
          return cookieStore.get('token')?.value || cookieStore.get('accessToken')?.value || null;
        } catch {
          return null;
        }
      }),
    ],
  },
});

export { serverApi, serverApiAsync, runServerGenerator };
