import { beforeEach, describe, expect, it } from 'vitest';
import { E2E_FLAG_KEY } from '../src/lib/e2e-constants';
import { createWebPermissionProfileHost } from '../src/lib/web-permission-profile-host';
import { LS_PERMISSION_MODE } from '../src/lib/settings-store';

describe('web permission profile host', () => {
  beforeEach(() => localStorage.clear());

  it('persists and reads the shared AgentApp permission key', async () => {
    const host = createWebPermissionProfileHost();
    await host.persistDefault('accept_edits');
    expect(localStorage.getItem(LS_PERMISSION_MODE)).toBe('accept_edits');
    expect(host.getPersisted()).toBe('accept_edits');
  });

  it('provides deterministic persistence failure injection without changing storage', async () => {
    localStorage.setItem(LS_PERMISSION_MODE, 'default');
    localStorage.setItem(E2E_FLAG_KEY, JSON.stringify({ permissionPersistenceFailures: 1 }));
    const host = createWebPermissionProfileHost();

    await expect(host.persistDefault('auto')).rejects.toThrow('E2E 执行配置持久化失败');
    expect(host.getPersisted()).toBe('default');
    expect(JSON.parse(localStorage.getItem(E2E_FLAG_KEY) ?? '{}'))
      .toMatchObject({ permissionPersistenceFailures: 0 });
  });
});
