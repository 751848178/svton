/** 站点域常量 - runtime 类型标签。 */

import type { SiteRuntimeType } from './types';

export const runtimeTypeLabels: Record<SiteRuntimeType, string> = {
  reverse_proxy: '反向代理',
  static: '静态站点',
  docker: 'Docker 服务',
  runtime: '运行时服务',
};
