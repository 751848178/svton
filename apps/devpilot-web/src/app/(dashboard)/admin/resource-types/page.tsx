import { serverRequest } from '@/lib/api-client/server';

import type { ResourceType } from './types';
import { ResourceTypesContent } from './components/ResourceTypesContent';

/** 该页在请求时读取 cookies() 鉴权，必须动态渲染。 */
export const dynamic = 'force-dynamic';

/**
 * 资源类型 — Server Component。
 *
 * 首屏在服务端取数（走 cookie 鉴权），下发 initialResourceTypes 给客户端 ResourceTypesContent（SWR fallback）。
 * 交互（新增/编辑/停用）由 ResourceTypesContent 承担。
 *
 * 注意：server 取到空列表时不传 fallback（传 undefined），让客户端 SWR 走正常 loading 流程，
 * 避免空数组被当作「已有数据」而不发起请求。
 */
export default async function ResourceTypesPage() {
  let initialResourceTypes: ResourceType[] | undefined;
  try {
    const data = await serverRequest<ResourceType[]>('GET:/resource-types?includeDisabled=true');
    initialResourceTypes = data.length > 0 ? data : undefined;
  } catch (error) {
    console.error('Failed to load resource types:', error);
  }

  return <ResourceTypesContent initialResourceTypes={initialResourceTypes} />;
}
