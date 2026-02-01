'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { api } from '@/lib/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();

  useEffect(() => {
    // 设置 API 客户端的 token getter
    api.setTokenGetter(() => useAuthStore.getState().token);
  }, []);

  return <>{children}</>;
}
