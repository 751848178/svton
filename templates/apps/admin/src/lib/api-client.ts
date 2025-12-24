/**
 * Admin 端 API Client
 * 使用优化后的 @svton/api-client 系统
 */

import axios from 'axios';
import {
  createApiClient,
  createTokenInterceptor,
  createUnauthorizedInterceptor,
} from '@svton/api-client';
// 引入类型定义以启用模块增强
import '{{ORG_NAME}}/types';

/**
 * Axios 适配器
 * 后端使用统一响应格式：{ code, data, message }
 */
const axiosAdapter = {
  async request(config: any) {
    const response = await axios.request(config);
    // 后端 ResponseInterceptor 包装格式：{ code: 0, data: {...}, message: 'success' }
    // 需要提取其中的 data 字段
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return response.data.data;
    }
    return response.data;
  },
};

/**
 * 创建 API 客户端实例
 */
const { api, apiAsync, runGenerator } = createApiClient(axiosAdapter, {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  interceptors: {
    // 请求拦截器 - 添加 Token
    request: [
      createTokenInterceptor(() => {
        if (typeof window !== 'undefined') {
          // 从 zustand persist 存储中读取 token
          const authStorage = localStorage.getItem('auth-storage');
          if (authStorage) {
            try {
              const { state } = JSON.parse(authStorage);
              return state?.accessToken || null;
            } catch (e) {
              console.error('[API Client] Failed to parse auth-storage:', e);
            }
          }
        }
        return null;
      }),
    ],
    // 错误拦截器 - 处理 401
    error: [
      createUnauthorizedInterceptor(() => {
        if (typeof window !== 'undefined') {
          // 清除 zustand persist 存储
          localStorage.removeItem('auth-storage');
          window.location.href = '/login';
        }
      }),
    ],
  },
});

// 导出 API 函数
export { api, apiAsync, runGenerator };

/**
 * 使用示例：
 *
 * // Generator 方式（推荐）
 * function* loadDashboard() {
 *   const user = yield* api('GET:/auth/me')
 *   const contents = yield* api('GET:/contents', { page: 1, pageSize: 10 })
 *   return { user, contents }
 * }
 *
 * const data = await runGenerator(loadDashboard())
 *
 * // Promise 方式
 * const user = await apiAsync('GET:/auth/me')
 * const contents = await apiAsync('GET:/contents', { page: 1 })
 *
 * // 创建内容
 * const newContent = await apiAsync('POST:/contents', {
 *   title: '标题',
 *   body: '内容',
 *   contentType: 'article',
 *   categoryId: 1,
 * })
 *
 * // 更新内容
 * const updated = await apiAsync('PUT:/contents/:id', {
 *   id: 123,
 *   data: { title: '新标题' }
 * })
 */
