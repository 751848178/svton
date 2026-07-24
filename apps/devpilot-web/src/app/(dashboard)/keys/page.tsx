import { serverRequest } from '@/lib/api-client/server';
import { redirectOnUnauthorized } from '@/lib/api-client/server-auth-redirect';

import type { SecretKey, KeyScopeFilter } from './types';
import { KeysContent } from './components/KeysContent';

/** 该页在请求时读取 cookies() 鉴权，必须动态渲染。 */
export const dynamic = 'force-dynamic';

/** 项目详情返回结构(只取 banner 需要的字段)。 */
interface ProjectForScope {
  id: string;
  name: string;
  environments?: { id: string; name: string }[];
}

/**
 * 密钥中心 — Server Component。
 *
 * 首屏在服务端取数（走 cookie 鉴权），下发 initialKeys 给客户端 KeysContent（SWR fallback）。
 * 交互（生成/存储/删除/查看明文）由 KeysContent 承担。
 *
 * 支持 URL 过滤：?projectId=&environmentId= —— 由 environment-detail-drawer 的「管理密钥」
 * 深链使用。scope 同时用于：服务端筛选首屏、客户端上下文横幅、存储弹窗预填作用域。
 * 横幅需要可读的项目名/环境名（而非原始 ID），故在服务端一并解析 scopeLabel。
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

  // 解析可读的作用域标签(项目名/环境名),避免横幅显示原始 ID。
  let scopeLabel: { projectName?: string; environmentName?: string } = {};
  if (scope.projectId) {
    try {
      const project = await serverRequest<ProjectForScope>(
        `GET:/projects/${scope.projectId}`,
      );
      const env = scope.environmentId
        ? project.environments?.find((e) => e.id === scope.environmentId)
        : undefined;
      scopeLabel = {
        projectName: project.name,
        environmentName: env?.name,
      };
    } catch (error) {
      redirectOnUnauthorized(error, '/keys');
      // 取名失败不阻断列表,横幅回退为 ID(由 KeysContent 处理)。
    }
  }

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

  return <KeysContent initialKeys={initialKeys} scope={scope} scopeLabel={scopeLabel} />;
}
