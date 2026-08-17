import type { PermissionMode } from '@svton/agent-core';
import type { ChatRuntimeSlot } from './chat-runtime-registry.types';

export function setRuntimeSlotPermission(
  slots: Map<string | null, ChatRuntimeSlot>,
  sessionId: string | null,
  mode: PermissionMode,
): boolean {
  const slot = slots.get(sessionId);
  if (!slot || !slot.runtime.setPermissionMode(mode)) return false;
  const actual = slot.runtime.getPermissionMode();
  if (actual !== mode) return false;
  slots.set(sessionId, { ...slot, permissionMode: actual });
  return true;
}
