import type { ReasoningEffort } from '@svton/agent-core';
import type { ChatRuntimeSlot } from './chat-runtime-registry.types';

export function setRuntimeSlotReasoning(
  slots: Map<string | null, ChatRuntimeSlot>,
  sessionId: string | null,
  effort: ReasoningEffort | undefined,
): boolean {
  const slot = slots.get(sessionId);
  if (!slot) return false;
  slot.runtime.setReasoningEffort(effort);
  slots.set(sessionId, {
    ...slot,
    reasoningEffort: effort,
    config: slot.config ? { ...slot.config, reasoningEffort: effort } : undefined,
  });
  return true;
}
