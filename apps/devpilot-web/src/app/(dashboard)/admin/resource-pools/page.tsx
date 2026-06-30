import { serverRequest } from '@/lib/api-client/server';

import type { ResourcePool } from './types';
import { ResourcePoolsContent } from './components/ResourcePoolsContent';

/** 该页在请求时读取 cookies() 鉴权，必须动态渲染。 */
export const dynamic = 'force-dynamic';

/**
 * 资源池管理 — Server Component。
 *
 * 首屏在服务端取数（走 cookie 鉴权），下发 initialPools 给客户端 ResourcePoolsContent（SWR fallback）。
 * 交互（新增/编辑/删除）由 ResourcePoolsContent 承担。
 *
 * 注意：server 取到空列表时不传 fallback（传 undefined），让客户端 SWR 走正常 loading 流程，
 * 避免空数组被当作「已有数据」而不发起请求。
 */
export default async function ResourcePoolsPage() {
  let initialPools: ResourcePool[] | undefined;
  try {
    const data = await serverRequest<ResourcePool[]>('GET:/resource-pools');
    initialPools = data.length > 0 ? data : undefined;
  } catch (error) {
    console.error('Failed to load resource pools:', error);
  }

  return <ResourcePoolsContent initialPools={initialPools} />;
}
