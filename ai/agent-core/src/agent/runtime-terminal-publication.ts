import type { PublicRuntimeEvent } from './types';

/** Publishes one runtime event, delaying terminal publication until settlement. */
export async function publishRuntimeEventAfterSettlement(
  event: PublicRuntimeEvent,
  settleTerminal: () => Promise<void>,
  publish: (event: PublicRuntimeEvent) => void,
): Promise<void> {
  if (event.type === 'agent_end') await settleTerminal();
  publish(event);
}
