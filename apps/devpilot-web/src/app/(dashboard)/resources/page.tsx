import { serverRequest } from '@/lib/api-client/server';
import { redirectOnUnauthorized } from '@/lib/api-client/server-auth-redirect';

import type { Resource, ResourceType } from './types';
import { ResourcesContent } from './components/ResourcesContent';

/** 该页在请求时读取 cookies() 鉴权，必须动态渲染。 */
export const dynamic = 'force-dynamic';

/**
 * 资源管理 — Server Component。
 *
 * 首屏在服务端取数（走 cookie 鉴权），下发 initialResources/initialResourceTypes 给客户端
 * ResourcesContent（SWR fallback）。添加/删除资源等交互由 ResourcesContent 承担。
 *
 * 注意：server 取到空列表时不传 fallback（传 undefined），让客户端 SWR 走正常 loading 流程。
 */
export default async function ResourcesPage() {
  let initialResources: Resource[] | undefined;
  let initialResourceTypes: ResourceType[] | undefined;
  try {
    const [resources, resourceTypes] = await Promise.all([
      serverRequest<Resource[]>('GET:/resources'),
      serverRequest<ResourceType[]>('GET:/registry/resource-types'),
    ]);
    initialResources = resources.length > 0 ? resources : undefined;
    initialResourceTypes = resourceTypes.length > 0 ? resourceTypes : undefined;
  } catch (error) {
    redirectOnUnauthorized(error, '/resources');
    console.error('Failed to load resources:', error);
  }

  return (
    <ResourcesContent
      initialResources={initialResources}
      initialResourceTypes={initialResourceTypes}
    />
  );
}
