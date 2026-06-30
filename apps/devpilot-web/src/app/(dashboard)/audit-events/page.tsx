import { serverRequest } from '@/lib/api-client/server';

import type { AuditEvent } from './types';
import { AuditEventsContent } from './components/AuditEventsContent';

/** 该页在请求时读取 cookies() 鉴权，必须动态渲染。 */
export const dynamic = 'force-dynamic';

/**
 * 审计事件 — Server Component。
 *
 * 首屏在服务端取数（走 cookie 鉴权），下发 initialEvents 给客户端 AuditEventsContent（SWR fallback）。
 * 筛选/刷新等交互由 AuditEventsContent 承担。
 *
 * 注意：server 取到空列表时不传 fallback（传 undefined），让客户端 SWR 走正常 loading 流程，
 * 避免空数组被当作「已有数据」而不发起请求。
 */
export default async function AuditEventsPage() {
  let initialEvents: AuditEvent[] | undefined;
  try {
    const data = await serverRequest<AuditEvent[]>('GET:/audit-events');
    initialEvents = data.length > 0 ? data : undefined;
  } catch (error) {
    console.error('Failed to load audit events:', error);
  }

  return <AuditEventsContent initialEvents={initialEvents} />;
}
