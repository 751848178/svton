import { serverRequest } from '@/lib/api-client/server';
import { redirectOnUnauthorized } from '@/lib/api-client/server-auth-redirect';

import type { Preset } from './types';
import { PresetsContent } from './components/PresetsContent';

/** 该页在请求时读取 cookies() 鉴权，必须动态渲染。 */
export const dynamic = 'force-dynamic';

/**
 * 配置预设 — Server Component。
 *
 * 首屏在服务端取数（走 cookie 鉴权），下发 initialPresets 给客户端 PresetsContent（SWR fallback）。
 * 加载/导入/导出/删除等交互由 PresetsContent 承担。
 */
export default async function PresetsPage() {
  let initialPresets: Preset[] | undefined;
  try {
    const data = await serverRequest<Preset[]>('GET:/presets');
    initialPresets = data.length > 0 ? data : undefined;
  } catch (error) {
    redirectOnUnauthorized(error, '/presets');
    console.error('Failed to load presets:', error);
  }

  return <PresetsContent initialPresets={initialPresets} />;
}
