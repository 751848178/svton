import type { PermissionMode } from '@svton/agent-core';
import type { PermissionProfileHost } from '@svton/agent-client';
import type { TauriPlatform } from '@svton/agent-platform';
import { useMemo } from 'react';

export function createDesktopPermissionProfileHost(
  platform: TauriPlatform,
  initialPersisted: PermissionMode,
): PermissionProfileHost {
  let persisted = initialPersisted;
  return {
    getPersisted: () => persisted,
    persistDefault: async (mode) => {
      await platform.storage.set('agent:permission_mode', mode);
      persisted = mode;
    },
  };
}

export function useDesktopPermissionProfileHost(
  platform: TauriPlatform,
  persistedMode: PermissionMode,
): PermissionProfileHost {
  return useMemo(
    () => createDesktopPermissionProfileHost(platform, persistedMode),
    [platform, persistedMode],
  );
}
