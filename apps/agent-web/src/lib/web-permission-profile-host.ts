import type { PermissionMode } from '@svton/agent-core';
import type { PermissionProfileHost } from '@svton/agent-client';
import { consumeE2ePermissionPersistenceFailure } from './e2e-permission-profile';
import { loadString, saveString, LS_PERMISSION_MODE } from './settings-store';

export function createWebPermissionProfileHost(): PermissionProfileHost {
  return {
    getPersisted: () => parseMode(loadString(LS_PERMISSION_MODE)),
    persistDefault: async (mode) => {
      consumeE2ePermissionPersistenceFailure();
      saveString(LS_PERMISSION_MODE, mode);
    },
  };
}

function parseMode(value: string): PermissionMode {
  return value === 'read_only' || value === 'plan' || value === 'accept_edits' || value === 'auto'
    ? value
    : 'default';
}
