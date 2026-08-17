import type { PermissionMode } from '@svton/agent-core';

export interface PermissionProfileHost {
  getPersisted: () => PermissionMode;
  persistDefault: (mode: PermissionMode) => Promise<void>;
}
