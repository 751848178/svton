import { serverRequest } from '@/lib/api-client/server';
import { redirectOnUnauthorized } from '@/lib/api-client/server-auth-redirect';

import type { Team } from '@/types/api-registry';
import { TeamsContent } from './components/TeamsContent';

/** 该页在请求时读取 cookies() 鉴权，必须动态渲染。 */
export const dynamic = 'force-dynamic';

/**
 * 团队管理 — Server Component。
 *
 * 首屏在服务端取数（走 cookie 鉴权），下发 initialTeams 给客户端 TeamsContent（SWR fallback）。
 * 创建/删除团队等交互由 TeamsContent 承担。
 *
 * 注意：server 取到空列表时不传 fallback（传 undefined），让客户端 SWR 走正常 loading 流程，
 * 避免空数组被当作「已有数据」而不发起请求。
 */
export default async function TeamsPage() {
  let initialTeams: Team[] | undefined;
  try {
    const data = await serverRequest<Team[]>('GET:/teams');
    initialTeams = data.length > 0 ? data : undefined;
  } catch (error) {
    redirectOnUnauthorized(error, '/teams');
    console.error('Failed to load teams:', error);
  }

  return <TeamsContent initialTeams={initialTeams} />;
}
