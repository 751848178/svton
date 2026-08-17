import type { SvtonAgentRuntime } from '@svton/agent-core';
import type { ChatRuntimeSlot } from './chat-runtime-registry.types';

type SessionAddress = string | null;
type RuntimeTasks = Map<SessionAddress, Promise<SvtonAgentRuntime>>;

export function abortRegisteredRuntime(
  slots: Map<SessionAddress, ChatRuntimeSlot>,
  sessionId: SessionAddress,
): boolean {
  const runtime = slots.get(sessionId)?.runtime;
  if (!runtime) return false;
  runtime.abort();
  return true;
}

export function cancelRegisteredRuntimeCreation(
  sessionId: SessionAddress,
  creating: RuntimeTasks,
  reconfiguring: RuntimeTasks,
  invalidations: Map<SessionAddress, 'refresh' | 'delete'>,
  bumpEpoch: () => void,
): boolean {
  if (!creating.has(sessionId) && !reconfiguring.has(sessionId)) return false;
  invalidatePending(sessionId, creating, reconfiguring, invalidations, bumpEpoch);
  return true;
}

export function deleteRegisteredRuntime(
  sessionId: SessionAddress,
  slots: Map<SessionAddress, ChatRuntimeSlot>,
  creating: RuntimeTasks,
  reconfiguring: RuntimeTasks,
  invalidations: Map<SessionAddress, 'refresh' | 'delete'>,
  bumpEpoch: () => void,
): boolean {
  invalidatePending(sessionId, creating, reconfiguring, invalidations, bumpEpoch);
  const slot = slots.get(sessionId);
  if (!slot) return false;
  slot.runtime.abort();
  slots.delete(sessionId);
  return true;
}

function invalidatePending(
  sessionId: SessionAddress,
  creating: RuntimeTasks,
  reconfiguring: RuntimeTasks,
  invalidations: Map<SessionAddress, 'refresh' | 'delete'>,
  bumpEpoch: () => void,
): void {
  invalidations.set(sessionId, 'delete');
  bumpEpoch();
  creating.delete(sessionId);
  reconfiguring.delete(sessionId);
}
