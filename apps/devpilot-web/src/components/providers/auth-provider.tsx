'use client';

import { useEffect } from 'react';
import { ServiceProviders } from './service-providers';
import { AuthServiceProvider } from '@/store/services';

/**
 * 内部：在 AuthServiceProvider 内部消费 auth service，挂载时恢复登录态。
 * 必须作为 AuthServiceProvider 的子组件，否则 useService 会抛错。
 */
function AuthHydrator() {
  const auth = AuthServiceProvider.useService();
  const hydrate = auth.useAction.hydrate();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return null;
}

/**
 * 认证 Provider
 *
 * - 挂载 ServiceProviders（auth/team/project-config 全局单例）。
 * - 客户端启动时从持久化层恢复登录态（hydrate）。
 *
 * token 注入由 api-client 拦截器直接读取持久化层完成，无需手动 setTokenGetter。
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ServiceProviders>
      <AuthHydrator />
      {children}
    </ServiceProviders>
  );
}
