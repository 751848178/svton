import { serverRequest } from '@/lib/api-client/server';
import { redirectOnUnauthorized } from '@/lib/api-client/server-auth-redirect';

import type { ProxyConfig } from './types';
import { ProxyConfigsContent } from './components/ProxyConfigsContent';

/** 该页在请求时读取 cookies() 鉴权，必须动态渲染。 */
export const dynamic = 'force-dynamic';

/**
 * 代理配置 — Server Component。
 *
 * 首屏在服务端取数（走 cookie 鉴权），下发 initialConfigs 给客户端 ProxyConfigsContent（SWR fallback）。
 * useSearchParams 需要 Suspense 边界，该边界保留在客户端 ProxyConfigsContent 内部
 * （紧贴 useSearchParams 调用点），交互（新增/同步/删除）由其承担。
 *
 * 注意：server 取到空列表时不传 fallback（传 undefined），让客户端 SWR 走正常 loading 流程。
 */
export default async function ProxyConfigsPage() {
  let initialConfigs: ProxyConfig[] | undefined;
  let initialError = '';
  try {
    const data = await serverRequest<ProxyConfig[]>('GET:/proxy-configs');
    initialConfigs = data.length > 0 ? data : undefined;
  } catch (error) {
    redirectOnUnauthorized(error, '/proxy-configs');
    initialError = error instanceof Error ? error.message : 'loadFailed';
  }

  return (
    <ProxyConfigsContent initialConfigs={initialConfigs} initialError={initialError} />
  );
}
