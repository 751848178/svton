import { E2E_FLAG_KEY } from './e2e-constants';

export function consumeE2ePermissionPersistenceFailure(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(E2E_FLAG_KEY);
    const flag = raw ? JSON.parse(raw) as Record<string, unknown> : null;
    const remaining = typeof flag?.permissionPersistenceFailures === 'number'
      ? flag.permissionPersistenceFailures
      : 0;
    if (!flag || remaining <= 0) return;
    localStorage.setItem(E2E_FLAG_KEY, JSON.stringify({
      ...flag, permissionPersistenceFailures: remaining - 1,
    }));
    throw new Error('E2E 执行配置持久化失败。');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('E2E 执行配置')) throw error;
  }
}
