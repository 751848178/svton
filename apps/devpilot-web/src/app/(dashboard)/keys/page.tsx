import { serverRequest } from '@/lib/api-client/server';

import type { SecretKey } from './types';
import { KeysContent } from './components/KeysContent';

/** 该页在请求时读取 cookies() 鉴权，必须动态渲染。 */
export const dynamic = 'force-dynamic';

/**
 * 密钥中心 — Server Component。
 *
 * 首屏在服务端取数（走 cookie 鉴权），下发 initialKeys 给客户端 KeysContent（SWR fallback）。
 * 交互（生成/存储/删除/查看明文）由 KeysContent 承担。
 *
 * 注意：server 取到空列表时不传 fallback（传 undefined），让客户端 SWR 走正常 loading 流程，
 * 避免空数组被当作「已有数据」而不发起请求。
 */
export default async function KeyCenterPage() {
  let initialKeys: SecretKey[] | undefined;
  try {
    const data = await serverRequest<SecretKey[]>('GET:/keys');
    initialKeys = data.length > 0 ? data : undefined;
  } catch (error) {
    console.error('Failed to load keys:', error);
  }

  return <KeysContent initialKeys={initialKeys} />;
}
