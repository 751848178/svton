/** 站点域常量 - runtime 类型 → i18n 键（`sites` 命名空间下）。 */

import type { SiteRuntimeType } from './types';

/** runtimeType → i18n 键。调用方用 `t(runtimeTypeLabels[type])` 解析。 */
export const runtimeTypeLabels: Record<SiteRuntimeType, string> = {
  reverse_proxy: 'rtReverseProxy',
  static: 'rtStatic',
  docker: 'rtDocker',
  runtime: 'rtRuntime',
};
