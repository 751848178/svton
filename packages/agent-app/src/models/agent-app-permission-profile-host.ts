import type { PermissionMode } from '@svton/agent-core';
import type { PermissionProfileHost } from '@svton/agent-client';
import type { ISettingsAdapter } from '@svton/agent-ui';

export function createAgentAppPermissionProfileHost(
  adapter: ISettingsAdapter,
): PermissionProfileHost {
  return {
    getPersisted: () => parsePermissionMode(adapter.getPermissionMode()),
    persistDefault: async (mode) => {
      await adapter.savePermissionMode(mode);
    },
  };
}

function parsePermissionMode(value: string): PermissionMode {
  return value === 'read_only' || value === 'plan' || value === 'accept_edits' || value === 'auto'
    ? value
    : 'default';
}
