/**
 * Service Providers 根包装
 *
 * 在应用根挂载所有全局 service 的 Provider，使全应用共享单例状态。
 * 单一职责：组合 Provider，不含业务逻辑。
 */

'use client';

import {
  AuthServiceProvider,
  TeamServiceProvider,
  ProjectConfigServiceProvider,
} from '@/store/services';

export function ServiceProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthServiceProvider>
      <TeamServiceProvider>
        <ProjectConfigServiceProvider>{children}</ProjectConfigServiceProvider>
      </TeamServiceProvider>
    </AuthServiceProvider>
  );
}
