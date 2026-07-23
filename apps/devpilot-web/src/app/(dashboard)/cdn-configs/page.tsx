import { serverRequest } from '@/lib/api-client/server';
import { redirectOnUnauthorized } from '@/lib/api-client/server-auth-redirect';

import type { CDNConfig, TeamCredential } from './types';
import { CdnConfigsContent } from './components/CdnConfigsContent';

/** 该页在请求时读取 cookies() 鉴权，必须动态渲染。 */
export const dynamic = 'force-dynamic';

/**
 * CDN 配置管理 — Server Component。
 *
 * 首屏在服务端取数（走 cookie 鉴权），同时拉取 CDN 配置与凭证两个列表，
 * 下发 initialConfigs / initialCredentials 给客户端 CdnConfigsContent（SWR fallback）。
 * 交互（新增/删除/缓存清除）由 CdnConfigsContent 承担。
 *
 * 注意：server 取到空列表时不传 fallback（传 undefined），让客户端 SWR 走正常 loading 流程。
 */
export default async function CDNConfigsPage() {
  let initialConfigs: CDNConfig[] | undefined;
  let initialCredentials: TeamCredential[] | undefined;
  let initialError = '';
  try {
    const [configs, credentials] = await Promise.all([
      serverRequest<CDNConfig[]>('GET:/cdn-configs'),
      serverRequest<TeamCredential[]>('GET:/team-credentials'),
    ]);
    initialConfigs = configs.length > 0 ? configs : undefined;
    initialCredentials = credentials.length > 0 ? credentials : undefined;
  } catch (error) {
    redirectOnUnauthorized(error, '/cdn-configs');
    initialError = error instanceof Error ? error.message : 'loadFailed';
  }

  return (
    <CdnConfigsContent
      initialConfigs={initialConfigs}
      initialCredentials={initialCredentials}
      initialError={initialError}
    />
  );
}
