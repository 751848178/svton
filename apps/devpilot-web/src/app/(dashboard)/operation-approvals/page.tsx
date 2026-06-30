import { serverRequest } from '@/lib/api-client/server';

import type { OperationApproval } from './types';
import { ApprovalsContent } from './components/ApprovalsContent';

/** 该页在请求时读取 cookies() 鉴权，必须动态渲染。 */
export const dynamic = 'force-dynamic';

/**
 * 操作审批 — Server Component。
 *
 * 首屏在服务端取数（默认 pending 视图，走 cookie 鉴权），下发 initialApprovals 给客户端
 * ApprovalsContent（SWR fallback）。状态筛选、审批决策、已批准执行由 ApprovalsContent 承担。
 */
export default async function OperationApprovalsPage() {
  let initialApprovals: OperationApproval[] | undefined;
  try {
    const data = await serverRequest<OperationApproval[]>('GET:/operation-approvals', {
      status: 'pending',
    });
    initialApprovals = data.length > 0 ? data : undefined;
  } catch (error) {
    console.error('Failed to load operation approvals:', error);
  }

  return <ApprovalsContent initialApprovals={initialApprovals} />;
}
