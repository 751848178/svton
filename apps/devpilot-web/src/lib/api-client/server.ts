/**
 * Server-side API 客户端（仅 Server Component / Route Handler 使用）
 *
 * 解决诉求：api-client 默认实例从 window.localStorage 读 token，无法在 Server Component
 * 中发起鉴权请求（SSR 时 window 不存在）。本文件用 next/headers 的 cookies() 读 token cookie，
 * 注入到同一套 fetch adapter，从而让 async Server Component 可直接发请求。
 *
 * 关键约束：本文件不得被打进 client bundle。它只 import：
 *   - 'next/headers'（Next 自动按调用点拆分，仅在 server 模块解析）
 *   - 复用 client 侧的 createFetchAdapter（纯函数，无 window 依赖）
 * 故只要「使用方」是 Server Component，本模块即只在 server 运行。
 *
 * token cookie 的来源：登录成功后 writePersistedAuth() 双写 localStorage + cookie（见 token-storage.ts），
 * middleware.ts 也读同一 cookie 做路由保护，故链路自洽。
 */

import '@/types/api-registry';
import { cookies } from 'next/headers';
import { createApiClient, type ApiName, type ApiParams, type ApiResponse } from '@svton/api-client';
import { createFetchAdapter } from './fetch-adapter';
import {
  type Interceptors,
  type RequestInterceptor,
} from '@svton/api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3101';

const TOKEN_COOKIE = 'token';
const TEAM_COOKIE = 'teamId';

/**
 * Server 端 token 注入拦截器：从 cookies() 读 token cookie 注入 Authorization。
 * 注意：cookies() 在 Next 15 返回 Promise，需 await。
 */
const serverTokenInterceptor: RequestInterceptor = async (config) => {
  const store = await cookies();
  const token = store.get(TOKEN_COOKIE)?.value;
  if (token && !config.headers['Authorization']) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
};

/**
 * Server 端 X-Team-Id 注入拦截器：从 cookies() 读 teamId cookie。
 */
const serverTeamHeaderInterceptor: RequestInterceptor = async (config) => {
  const store = await cookies();
  const teamId = store.get(TEAM_COOKIE)?.value;
  if (teamId && !config.headers['X-Team-Id']) {
    config.headers['X-Team-Id'] = teamId;
  }
  return config;
};

function createServerInterceptors(): Interceptors {
  return {
    request: [serverTokenInterceptor, serverTeamHeaderInterceptor],
    // server 端不发错误拦截：401 不会清理 localStorage（server 无法访问），
    // 也无法 window.location 跳转——交给 middleware 层处理路由保护。
    error: [],
  };
}

const { apiAsync: serverApiAsyncRaw } = createApiClient(createFetchAdapter(), {
  baseURL: `${API_BASE_URL}/api`,
  interceptors: createServerInterceptors(),
});

/**
 * 类型化的 Server 端异步请求（等价 client 侧 apiAsync，但走 cookie 鉴权）。
 *
 * 仅用于已登记到 GlobalApiRegistry 的端点（auth/team）。其余端点用 `serverRequest`。
 *
 * @example
 * ```tsx
 * // app/(dashboard)/projects/page.tsx
 * export default async function ProjectsPage() {
 *   const projects = await serverRequest<Project[]>('GET:/projects');
 *   return <ProjectsView projects={projects} />;
 * }
 * ```
 */
export function serverApiAsync<K extends ApiName>(
  apiName: K,
  ...args: ApiParams<K> extends void ? [] : [ApiParams<K>]
): Promise<ApiResponse<K>> {
  return serverApiAsyncRaw(apiName, ...args);
}

/**
 * 宽松的 Server 端请求入口（等价 client 侧 apiRequest，走 cookie 鉴权）。
 *
 * 用于尚未登记到 GlobalApiRegistry 的端点。调用方用泛型显式声明响应类型。
 * Server Component / Route Handler 专用——不得在 client 组件中 import。
 */
export async function serverRequest<T = unknown>(apiName: string, params?: unknown): Promise<T> {
  return (serverApiAsyncRaw as unknown as (name: string, p?: unknown) => Promise<T>)(
    apiName,
    params,
  );
}
