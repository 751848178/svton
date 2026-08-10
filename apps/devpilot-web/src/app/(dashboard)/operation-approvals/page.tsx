import { serverRequest } from '@/lib/api-client/server';
import { redirectOnUnauthorized } from '@/lib/api-client/server-auth-redirect';

import type { OperationApproval } from './types';
import { ApprovalsContent } from './components/ApprovalsContent';

/** 该页在请求时读取 cookies() 鉴权，必须动态渲染。 */
export const dynamic = 'force-dynamic';

/**
 * 操作审批 — Server Component。
 *
 * 首屏在服务端取数（默认 pending 视图，走 cookie 鉴权），下发 initialApprovals 给客户端
 * ApprovalsContent（SWR fallback）。深链 ?id=<approvalId> 时按 all 取数并聚焦该卡片。
 */
export default async function OperationApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const initialApprovalId = params.id?.trim() || undefined;
  let initialApprovals: OperationApproval[] | undefined;
  try {
    const data = await serverRequest<OperationApproval[]>('GET:/operation-approvals', {
      status: initialApprovalId ? 'all' : 'pending',
    });
    initialApprovals = data.length > 0 ? data : undefined;
  } catch (error) {
    redirectOnUnauthorized(error, '/operation-approvals');
    console.error('Failed to load operation approvals:', error);
  }

  return (
    <ApprovalsContent
      initialApprovals={initialApprovals}
      initialApprovalId={initialApprovalId}
    />
  );
}
