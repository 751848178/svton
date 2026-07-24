import { serverRequest } from '@/lib/api-client/server';
import { redirectOnUnauthorized } from '@/lib/api-client/server-auth-redirect';

import type { SecretKey, KeyScopeFilter } from './types';
import { KeysContent } from './components/KeysContent';

/** 该页在请求时读取 cookies() 鉴权，必须动态渲染。 */
export const dynamic = 'force-dynamic';

/**
 * 密钥中心 — Server Component。
 *
 * 首屏在服务端取数（走 cookie 鉴权），下发 initialKeys 给客户端 KeysContent（SWR fallback）。
 * 交互（生成/存储/删除/查看明文）由 KeysContent 承担。
 *
 * 支持 URL 过滤：?projectId=&environmentId= —— 由 environment-detail-drawer 的「新增密钥」
 * 深链使用。scope 同时用于：服务端筛选首屏、客户端上下文横幅、存储弹窗预填作用域。
 *
 * 注意：server 取到空列表时不传 fallback（传 undefined），让客户端 SWR 走正常 loading 流程，
 * 避免空数组被当作「已有数据」而不发起请求。
 */
export default async function KeyCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; environmentId?: string }>;
}) {
  const sp = await searchParams;
  const scope: KeyScopeFilter = {
    projectId: sp.projectId || undefined,
    environmentId: sp.environmentId || undefined,
  };
  const hasScope = Boolean(scope.projectId || scope.environmentId);

  let initialKeys: SecretKey[] | undefined;
  try {
    const data = hasScope
      ? await serverRequest<SecretKey[]>('GET:/keys', scope)
      : await serverRequest<SecretKey[]>('GET:/keys');
    initialKeys = data.length > 0 ? data : undefined;
  } catch (error) {
    redirectOnUnauthorized(error, '/keys');
    console.error('Failed to load keys:', error);
  }

  return <KeysContent initialKeys={initialKeys} scope={scope} />;
}
