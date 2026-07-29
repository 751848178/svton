import type { AgentConfig, PermissionMode } from '@svton/agent-core';

export type AgentShellPermissionMode = PermissionMode;

export function readAgentShellPermissionMode(config: AgentConfig): AgentShellPermissionMode {
  return config.capabilities?.permissionManager?.getMode() ?? 'default';
}
