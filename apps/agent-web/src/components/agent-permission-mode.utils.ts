import type { AgentConfig } from '@svton/agent-core';

export type AgentPermissionMode =
  | 'read_only'
  | 'plan'
  | 'default'
  | 'accept_edits'
  | 'auto';

export type RestorablePermissionMode = Exclude<AgentPermissionMode, 'plan'>;

const RESTORABLE_PERMISSION_MODES: RestorablePermissionMode[] = [
  'read_only',
  'default',
  'accept_edits',
  'auto',
];

export function readConfigPermissionMode(config: AgentConfig): AgentPermissionMode {
  return (config.capabilities?.permissionManager?.getMode() as AgentPermissionMode | undefined) ?? 'default';
}

export function readConfigPlanMode(config: AgentConfig): boolean {
  return readConfigPermissionMode(config) === 'plan';
}

export function toRestorablePermissionMode(mode: AgentPermissionMode): RestorablePermissionMode {
  return RESTORABLE_PERMISSION_MODES.includes(mode as RestorablePermissionMode)
    ? (mode as RestorablePermissionMode)
    : 'default';
}

export function readRestorablePermissionMode(config: AgentConfig): RestorablePermissionMode {
  return toRestorablePermissionMode(readConfigPermissionMode(config));
}
