import type { AgentConfig } from '@svton/agent-core';

export type AgentShellPermissionMode =
  | 'read_only'
  | 'plan'
  | 'default'
  | 'accept_edits'
  | 'auto';

export function readAgentShellPermissionMode(config: AgentConfig): AgentShellPermissionMode {
  return (config.capabilities?.permissionManager?.getMode() as AgentShellPermissionMode | undefined) ?? 'default';
}
