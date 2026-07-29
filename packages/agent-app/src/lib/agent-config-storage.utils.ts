import type { PermissionMode } from '@svton/agent-core';
import type { AgentAppStorage } from './storage';

export const AGENT_CONFIG_STORAGE_KEYS = {
  stabilityKey: 'stabilityKey',
  googleKey: 'googleKey',
  disabledTools: 'disabledTools',
  disabledSkills: 'disabledSkills',
  permissionMode: 'permissionMode',
  customInstructions: 'customInstructions',
} as const;

export function loadStoredString(
  storage: AgentAppStorage,
  key: string,
): string {
  return storage.getString(key);
}

export function loadStoredStringList(
  storage: AgentAppStorage,
  key: string,
): string[] {
  const value = storage.getJson<unknown>(key, []);
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function loadPermissionMode(storage: AgentAppStorage): PermissionMode {
  const value = loadStoredString(storage, AGENT_CONFIG_STORAGE_KEYS.permissionMode);
  return value === 'read_only'
    || value === 'plan'
    || value === 'accept_edits'
    || value === 'auto'
    ? value
    : 'default';
}
