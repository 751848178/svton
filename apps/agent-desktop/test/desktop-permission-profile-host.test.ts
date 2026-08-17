import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TauriPlatform } from '@svton/agent-platform';
import type { PermissionMode } from '@svton/agent-core';
import {
  createDesktopPermissionProfileHost,
  useDesktopPermissionProfileHost,
} from '../src/lib/desktop-permission-profile-host';

describe('desktop permission profile host', () => {
  it('updates its persisted projection only after storage succeeds', async () => {
    const set = vi.fn(async () => {});
    const host = createDesktopPermissionProfileHost({ storage: { set } } as unknown as TauriPlatform, 'default');

    await host.persistDefault('auto');
    expect(set).toHaveBeenCalledWith('agent:permission_mode', 'auto');
    expect(host.getPersisted()).toBe('auto');
  });

  it('keeps the prior persisted projection after storage failure', async () => {
    const set = vi.fn(async () => { throw new Error('disk unavailable'); });
    const host = createDesktopPermissionProfileHost({ storage: { set } } as unknown as TauriPlatform, 'default');

    await expect(host.persistDefault('auto')).rejects.toThrow('disk unavailable');
    expect(host.getPersisted()).toBe('default');
  });

  it('refreshes the host projection when a reinitialized config changes persisted mode', () => {
    const platform = { storage: { set: vi.fn() } } as unknown as TauriPlatform;
    const hook = renderHook<ReturnType<typeof useDesktopPermissionProfileHost>, { mode: PermissionMode }>(
      ({ mode }) => useDesktopPermissionProfileHost(platform, mode),
      { initialProps: { mode: 'default' } },
    );
    expect(hook.result.current.getPersisted()).toBe('default');

    hook.rerender({ mode: 'auto' });
    expect(hook.result.current.getPersisted()).toBe('auto');
  });
});
