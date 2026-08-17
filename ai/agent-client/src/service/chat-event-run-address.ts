import { canonicalSessionId, type PublicRuntimeEvent } from '@svton/agent-core';
import { decisionEventSessionId } from './chat-event-context';
import type { ChatRunCoordinatorService } from './chat-run-coordinator.service';
import type { ChatRunAddress } from './chat-run.types';

/** Resolves only legacy/injected events; real runtime events carry a captured address. */
export function resolveCompatibilityEventAddress(
  event: PublicRuntimeEvent,
  runs: ChatRunCoordinatorService,
  activeLease: ChatRunAddress | null,
  activeSessionId: string | null,
  backgroundSessionId: string | null,
): ChatRunAddress | undefined {
  if (activeLease) return activeLease;
  const eventSessionId = decisionEventSessionId(event);
  if (eventSessionId) {
    const matchingOwner = [backgroundSessionId, activeSessionId].find(
      (sessionId) => canonicalSessionId(sessionId) === eventSessionId,
    );
    const ownerSessionId = matchingOwner === undefined ? eventSessionId : matchingOwner;
    return runs.address(ownerSessionId) ?? undefined;
  }
  return runs.address(backgroundSessionId) ?? runs.address(activeSessionId) ?? undefined;
}
